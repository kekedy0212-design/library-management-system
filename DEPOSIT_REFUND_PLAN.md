# 押金回退功能实现方案

## 一、现状分析

### 1.1 已实现的押金支付功能

#### 数据模型
- **Deposit 表**：记录用户押金
  - 状态：`UNPAID`, `PENDING`, `PAID`, `REFUND_PENDING`, `REFUNDED`, `FAILED`
  - 字段：`user_id`, `amount`, `status`, `paid_at`, `refunded_at`, `created_at`, `updated_at`
  
- **DepositTransaction 表**：记录交易流水
  - 类型：`PAY`（支付）, `REFUND`（退款）
  - 字段：`deposit_id`, `biz_type`, `out_trade_no`, `trade_no`, `status`, `amount`, `channel`, `raw_notify`

#### 已有接口
| 接口 | 方法 | 功能 |
|------|------|------|
| `/deposits/me` | GET | 获取当前用户押金信息 |
| `/deposits/create-order` | POST | 创建押金支付订单 |
| `/deposits/confirm` | POST | 兜底确认支付结果 |
| `/payments/alipay/notify` | POST | 支付宝异步回调 |

### 1.2 支付流程总结
```
用户发起支付 → 创建订单(create-order) → 生成支付宝链接 → 用户支付 
→ 支付宝异步回调(notify) → 更新状态为PAID → 兜底确认(confirm)
```

---

## 二、押金回退需求分析

### 2.1 业务场景
- 用户注销账号时需要回退押金
- 用户因特殊原因（如管理员发起）需要退款
- 系统异常导致需要手动退款

### 2.2 核心业务规则
1. 只有 **PAID** 状态的押金才能退款
2. 退款操作会产生新的交易流水（`biz_type=REFUND`）
3. 退款后 Deposit 状态变为 **REFUNDED**
4. 退款流程包含：**发起退款 → 支付宝处理 → 异步回调 → 状态更新**

---

## 三、可行实现方案

### 3.1 后端实现方案

#### 第一步：数据库完善（DepositTransaction 模型补充）

[deposits.py] 已有 `refunded_at` 字段，无需修改

#### 第二步：CRUD 层添加退款相关函数

在 `crud_deposit.py` 中新增：

```python
def create_refund_transaction(
    db: Session,
    deposit_id: int,
    out_refund_no: str,
    amount: Decimal,
) -> DepositTransaction:
    """创建退款交易流水"""
    tx = DepositTransaction(
        deposit_id=deposit_id,
        biz_type=TransactionType.REFUND,
        out_trade_no=out_refund_no,  # 退款单号
        amount=amount,
        channel="alipay",
        status=TransactionStatus.CREATED,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def set_deposit_refund_pending(db: Session, deposit: Deposit):
    """设置押金状态为退款中"""
    deposit.status = DepositStatus.REFUND_PENDING
    db.add(deposit)
    db.commit()
    db.refresh(deposit)
    return deposit


def mark_refund_success(
    db: Session,
    tx: DepositTransaction,
    trade_no: str | None,
    notify_payload: str,
):
    """标记退款成功"""
    if tx.status == TransactionStatus.SUCCESS:
        return tx

    tx.status = TransactionStatus.SUCCESS
    tx.trade_no = trade_no
    tx.raw_notify = notify_payload
    tx.updated_at = datetime.utcnow()

    deposit = db.query(Deposit).filter(Deposit.id == tx.deposit_id).first()
    if deposit and deposit.status != DepositStatus.REFUNDED:
        deposit.status = DepositStatus.REFUNDED
        deposit.refunded_at = datetime.utcnow()
        db.add(deposit)

    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def mark_refund_failed(db: Session, tx: DepositTransaction, notify_payload: str):
    """标记退款失败"""
    tx.status = TransactionStatus.FAILED
    tx.raw_notify = notify_payload
    tx.updated_at = datetime.utcnow()
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx
```

#### 第三步：Schema 层添加退款请求/响应模型

在 `schemas/deposit.py` 中新增：

```python
class DepositRefundRequest(BaseModel):
    """退款请求"""
    reason: str | None = None  # 退款原因


class DepositRefundResponse(BaseModel):
    """退款响应"""
    out_refund_no: str
    amount: Decimal
    status: str


class DepositRefundConfirmRequest(BaseModel):
    """退款确认请求"""
    out_refund_no: str
```

#### 第四步：API 层添加退款接口

在 `endpoints/deposit.py` 中新增：

```python
@router.post("/deposits/refund", response_model=DepositRefundResponse)
def request_deposit_refund(
    refund_in: DepositRefundRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    发起押金退款申请
    - 只能退款 PAID 状态的押金
    - 返回支付宝退款链接
    """
    deposit = crud_deposit.get_user_deposit(db, current_user.id)
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    
    if deposit.status != DepositStatus.PAID:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot refund deposit with status: {deposit.status}"
        )
    
    try:
        alipay = get_alipay_client()
    except RuntimeError as exc:
        logger.error(f"Alipay client unavailable: {exc}")
        raise HTTPException(status_code=503, detail="Payment service not configured")
    
    # 生成退款单号
    out_refund_no = f"refund_{current_user.id}_{uuid4().hex[:12]}"
    
    try:
        # 调用支付宝退款API
        # 需要原支付的trade_no，从最后一条成功的支付交易中获取
        last_pay_tx = db.query(DepositTransaction).filter(
            DepositTransaction.deposit_id == deposit.id,
            DepositTransaction.biz_type == TransactionType.PAY,
            DepositTransaction.status == TransactionStatus.SUCCESS,
        ).order_by(DepositTransaction.created_at.desc()).first()
        
        if not last_pay_tx or not last_pay_tx.trade_no:
            raise HTTPException(
                status_code=400, 
                detail="No successful payment found for refund"
            )
        
        result = alipay.api_alipay_trade_refund(
            out_trade_no=last_pay_tx.out_trade_no,
            trade_no=last_pay_tx.trade_no,
            out_refund_no=out_refund_no,
            refund_amount=str(deposit.amount),
            refund_reason=refund_in.reason or "User requested deposit refund"
        )
        
        # 检查退款是否立即成功（有些情况下支付宝会立即返回成功）
        if result.get("code") == "10000" and result.get("refund_status") == "REFUND_SUCCESS":
            crud_deposit.set_deposit_refund_pending(db, deposit)
            refund_tx = crud_deposit.create_refund_transaction(
                db=db,
                deposit_id=deposit.id,
                out_refund_no=out_refund_no,
                amount=deposit.amount,
            )
            # 立即标记为成功（如果支付宝返回成功）
            crud_deposit.mark_refund_success(
                db,
                refund_tx,
                result.get("trade_no"),
                json.dumps(result, ensure_ascii=False)
            )
            logger.info(
                f"✅ [押金退款] 用户 '{current_user.username}' | 用户 ID: {current_user.id} | "
                f"退款单号: {out_refund_no} | 金额: {deposit.amount} | 状态: 成功"
            )
        else:
            # 否则设为待确认状态，等待异步回调
            crud_deposit.set_deposit_refund_pending(db, deposit)
            refund_tx = crud_deposit.create_refund_transaction(
                db=db,
                deposit_id=deposit.id,
                out_refund_no=out_refund_no,
                amount=deposit.amount,
            )
            logger.info(
                f"⏳ [押金退款] 用户 '{current_user.username}' | 用户 ID: {current_user.id} | "
                f"退款单号: {out_refund_no} | 金额: {deposit.amount} | 状态: 待处理"
            )
        
        return {
            "out_refund_no": out_refund_no,
            "amount": deposit.amount,
            "status": "processing",
        }
        
    except Exception as exc:
        logger.exception(f"Failed to create Alipay refund: {exc}")
        raise HTTPException(
            status_code=503,
            detail=f"Failed to process refund. {exc}"
        )


@router.post("/payments/alipay/refund-notify")
async def alipay_refund_notify(request: Request, db: Session = Depends(get_db)):
    """
    支付宝退款异步回调处理
    - 验证签名
    - 更新退款交易和押金状态
    """
    form = await request.form()
    payload = dict(form)

    sign = payload.pop("sign", None)
    payload.pop("sign_type", None)
    out_refund_no = payload.get("out_refund_no")
    refund_status = payload.get("refund_status")
    trade_no = payload.get("trade_no")

    if not sign or not out_refund_no:
        return PlainTextResponse("failure")

    try:
        alipay = get_alipay_client()
        verified = alipay.verify(payload, sign)
    except Exception as e:
        logger.error(f"❌ [支付宝退款回调] 验签失败: {str(e)}")
        return PlainTextResponse("failure")

    if not verified:
        logger.warning(f"⚠️ [支付宝退款回调] 验签未通过 | out_refund_no: {out_refund_no}")
        return PlainTextResponse("failure")

    # 查找退款交易
    tx = crud_deposit.get_transaction_by_out_trade_no(db, out_refund_no)
    if not tx:
        logger.warning(f"⚠️ [支付宝退款回调] 未找到退款流水 | out_refund_no: {out_refund_no}")
        return PlainTextResponse("failure")

    raw_notify = json.dumps(dict(form), ensure_ascii=False)
    
    if refund_status == "REFUND_SUCCESS":
        crud_deposit.mark_refund_success(db, tx, trade_no, raw_notify)
        logger.info(f"✅ [支付宝退款回调] 押金退款成功 | out_refund_no: {out_refund_no}")
        return PlainTextResponse("success")
    
    crud_deposit.mark_refund_failed(db, tx, raw_notify)
    logger.warning(f"⚠️ [支付宝退款回调] 退款失败 | out_refund_no: {out_refund_no} | refund_status: {refund_status}")
    return PlainTextResponse("failure")


@router.post("/deposits/confirm-refund", response_model=DepositRefundResponse)
def confirm_deposit_refund(
    confirm_in: DepositRefundConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    兜底确认接口：退款版本
    - 前端回跳后查询支付宝退款状态并更新本地状态
    """
    tx = crud_deposit.get_transaction_by_out_trade_no(db, confirm_in.out_refund_no)
    if not tx:
        raise HTTPException(status_code=404, detail="Refund transaction not found")

    deposit = crud_deposit.get_user_deposit(db, current_user.id)
    if not deposit or tx.deposit_id != deposit.id:
        raise HTTPException(status_code=403, detail="Refund does not belong to current user")

    alipay = get_alipay_client()
    
    try:
        # 查询退款状态
        result = alipay.api_alipay_trade_fastpay_refund_query(
            out_trade_no=None,  # 如果支付宝支持，可用out_refund_no查询
            out_refund_no=confirm_in.out_refund_no
        )
        refund_status = result.get("refund_status")
        
        if refund_status == "REFUND_SUCCESS":
            crud_deposit.mark_refund_success(
                db,
                tx,
                result.get("trade_no"),
                json.dumps(result, ensure_ascii=False)
            )
            return {
                "out_refund_no": confirm_in.out_refund_no,
                "amount": deposit.amount,
                "status": "refunded",
            }
        else:
            return {
                "out_refund_no": confirm_in.out_refund_no,
                "amount": deposit.amount,
                "status": "processing",
            }
    except Exception as exc:
        logger.error(f"Failed to query refund status: {exc}")
        raise HTTPException(status_code=503, detail="Failed to query refund status")
```

---

### 3.2 前端实现方案

#### 第一步：添加退款 Service

在 `src/services/depositService.js` 中新增：

```javascript
export const depositService = {
  // 已有方法...
  
  // 发起退款
  requestRefund: (reason = '') => {
    return api.post('/deposits/refund', {
      reason: reason || '用户申请退款'
    });
  },
  
  // 确认退款状态
  confirmRefund: (outRefundNo) => {
    return api.post('/deposits/confirm-refund', {
      out_refund_no: outRefundNo
    });
  }
};
```

#### 第二步：更新 DepositCenter 组件

在 `src/pages/Deposit/DepositCenter.js` 中添加：

```javascript
// 1. 添加退款状态和输入框状态
const [refunding, setRefunding] = useState(false);
const [showRefundReason, setShowRefundReason] = useState(false);
const [refundReason, setRefundReason] = useState('');

// 2. 添加退款处理函数
const handleRefundClick = async () => {
  try {
    setRefunding(true);
    const response = await depositService.requestRefund(refundReason);
    const outRefundNo = response.data.out_refund_no;
    
    // 开始轮询确认
    let attempt = 0;
    const maxAttempts = 8;
    const intervalMs = 1500;
    let timer = null;
    
    const checkRefundStatus = async () => {
      attempt += 1;
      
      if (attempt === 1) {
        try {
          await depositService.confirmRefund(outRefundNo);
        } catch {
          // 忽略确认错误
        }
      }
      
      const data = await loadDeposit(true);
      if (data?.status === 'refunded') {
        if (timer) clearInterval(timer);
        setShowRefundReason(false);
        setRefundReason('');
        setToast({
          visible: true,
          type: 'success',
          text: '退款成功！押金已返还到您的支付宝账户。',
        });
        return;
      }
      
      if (attempt >= maxAttempts) {
        if (timer) clearInterval(timer);
        setStatusNotice('退款处理中，请稍候查看更新状态。');
      }
    };
    
    checkRefundStatus();
    timer = setInterval(checkRefundStatus, intervalMs);
    
  } catch (err) {
    setToast({
      visible: true,
      type: 'error',
      text: `退款失败: ${err.response?.data?.detail || err.message}`,
    });
  } finally {
    setRefunding(false);
  }
};

// 3. 在 UI 中添加退款按钮
{deposit.status === 'paid' && (
  <button 
    onClick={() => setShowRefundReason(!showRefundReason)}
    disabled={refunding}
  >
    {refunding ? '处理中...' : '申请退款'}
  </button>
)}

{showRefundReason && (
  <div className="refund-reason-form">
    <textarea
      placeholder="请输入退款原因（可选）"
      value={refundReason}
      onChange={(e) => setRefundReason(e.target.value)}
    />
    <button onClick={handleRefundClick} disabled={refunding}>
      确认退款
    </button>
  </div>
)}
```

---

## 四、实现步骤（优先级排序）

### 优先级 1（核心功能）
- [ ] 后端 `crud_deposit.py`：添加退款相关 CRUD 函数
- [ ] 后端 `schemas/deposit.py`：添加退款请求/响应 Schema
- [ ] 后端 `endpoints/deposit.py`：
  - 添加 `/deposits/refund` 发起退款接口
  - 添加 `/payments/alipay/refund-notify` 退款回调处理
  - 添加 `/deposits/confirm-refund` 退款确认接口

### 优先级 2（前端展示）
- [ ] 前端 `depositService.js`：添加 `requestRefund()` 和 `confirmRefund()` 方法
- [ ] 前端 `DepositCenter.js`：
  - 添加退款按钮和表单
  - 处理退款流程和状态轮询
  - 添加退款成功/失败提示

### 优先级 3（完善与测试）
- [ ] 接口文档更新：添加退款相关接口说明
- [ ] 单元测试：退款相关函数测试
- [ ] 集成测试：完整退款流程测试
- [ ] 异常处理：网络异常、重复申请等边界情况

---

## 五、关键技术点

### 5.1 支付宝 API 调用

| 操作 | API 方法 | 说明 |
|------|---------|------|
| 发起退款 | `api_alipay_trade_refund()` | 需要原支付单号或交易号 |
| 查询退款 | `api_alipay_trade_fastpay_refund_query()` | 通过退款单号查询 |
| 退款回调 | 服务器回调 | 支付宝服务端通知退款结果 |

### 5.2 状态流转图

```
PAID 状态
  ↓
用户发起退款 (POST /deposits/refund)
  ↓
REFUND_PENDING 状态 ← 创建 REFUND 类型交易流水
  ↓
支付宝异步回调 (POST /payments/alipay/refund-notify)
  ↓
REFUNDED 状态 ← 更新 refunded_at 字段
```

### 5.3 幂等性处理

- 同一 `out_refund_no` 不能重复创建
- 支付宝退款本身是幂等的（支付宝侧会去重）
- 使用 UUID 生成唯一退款单号确保唯一性

---

## 六、测试场景

### 6.1 正常流程测试
1. ✅ 用户支付押金成功
2. ✅ 用户申请退款
3. ✅ 支付宝处理退款
4. ✅ 异步回调更新状态
5. ✅ 前端显示退款成功

### 6.2 异常场景测试
- ❌ 未支付时申请退款（返回 400）
- ❌ 支付宝退款失败回调
- ❌ 网络异常导致回调未收到（使用兜底确认）
- ❌ 重复申请退款
- ❌ 无效的支付宝配置

---

## 七、安全考虑

1. **权限校验**：确保只有自己或管理员能申请自己的退款
2. **金额核实**：退款金额必须与原支付金额一致
3. **签名验证**：所有支付宝回调都需要签名验证
4. **操作日志**：记录所有退款操作和异常
5. **支付宝配置**：确保退款回调地址配置正确

---

## 八、配置需求

需要在 `.env` 中确保已配置：
```
ALIPAY_APPID=xxx
ALIPAY_PRIVATE_KEY=xxx
ALIPAY_PUBLIC_KEY=xxx
ALIPAY_NOTIFY_URL=http://your-domain/api/v1/payments/alipay/notify
# 新增退款回调地址（如果支付宝支持独立配置）
ALIPAY_REFUND_NOTIFY_URL=http://your-domain/api/v1/payments/alipay/refund-notify
```

---

## 总结

该方案完全复用了现有的支付流程架构，只需：
1. **后端**：~150 行新代码（CRUD + API 接口 + 支付宝调用）
2. **前端**：~80 行新代码（Service + UI 组件）
3. **数据库**：无需修改（已有相关字段和状态）

整体工作量中等，可完全兼容现有支付功能，风险较低。

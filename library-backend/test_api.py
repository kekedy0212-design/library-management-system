import requests
import json

# 测试服务器连接
try:
    response = requests.get('http://localhost:8000/api/v1/health', timeout=5)
    print(f"✅ 服务器连接成功: {response.status_code}")
except Exception as e:
    print(f"❌ 服务器连接失败: {e}")
    exit(1)

# 用默认管理员账号登录
login_data = {
    "username": "admin",
    "password": "admin123"
}

try:
    response = requests.post('http://localhost:8000/api/v1/auth/login', data=login_data, timeout=5)
    if response.status_code == 200:
        token = response.json().get('access_token')
        print(f"✅ 登录成功，Token: {token[:20]}...")
        
        # 测试获取借阅历史
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get('http://localhost:8000/api/v1/users/me/borrow-history', headers=headers, timeout=5)
        print(f"📚 借阅历史响应码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 借阅历史数据 (条数: {len(data)})")
            if data:
                print(f"   第一条记录: {json.dumps(data[0], indent=2, default=str)[:500]}")
        else:
            print(f"❌ 错误: {response.text[:200]}")
    else:
        print(f"❌ 登录失败: {response.status_code} - {response.text[:200]}")
except Exception as e:
    print(f"❌ 请求失败: {e}")

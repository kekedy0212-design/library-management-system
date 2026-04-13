import requests

base_url = 'http://127.0.0.1:8000'

# 测试登录
login_data = {'username': 'admin', 'password': 'admin123'}
login_response = requests.post(f'{base_url}/auth/login', data=login_data)

if login_response.status_code == 200:
    token = login_response.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}

    # 测试获取用户
    users_response = requests.get(f'{base_url}/users', headers=headers)
    if users_response.status_code == 200:
        users = users_response.json()
        print(f'API测试成功 - 获取到 {len(users)} 个用户')

        if len(users) > 2:
            test_user = users[2]
            print(f'测试用户: {test_user["username"]}')

            # 测试禁用用户
            user_id = test_user['id']
            update_response = requests.put(f'{base_url}/users/{user_id}',
                                         json={'is_active': False}, headers=headers)
            print(f'禁用用户状态码: {update_response.status_code}')

            # 测试重置密码
            reset_response = requests.post(f'{base_url}/users/{user_id}/reset-password',
                                         json={'new_password': 'newpass123'}, headers=headers)
            print(f'重置密码状态码: {reset_response.status_code}')
    else:
        print(f'获取用户失败: {users_response.status_code}')
else:
    print(f'登录失败: {login_response.status_code}')
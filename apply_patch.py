from pathlib import Path

# Update schema
user_schema = Path('library-backend/app/schemas/user.py')
content = user_schema.read_text(encoding='utf-8')
needle = 'class UserPublic(UserBase):\n'
if needle not in content:
    raise SystemExit('needle not found in user schema')
replacement = 'class UserPasswordReset(BaseModel):\n    new_password: str\n\n' + needle
content = content.replace(needle, replacement, 1)
user_schema.write_text(content, encoding='utf-8')
print('schema updated')

# Update endpoint
users_file = Path('library-backend/app/api/v1/endpoints/users.py')
content = users_file.read_text(encoding='utf-8')
old = '@router.post("/{user_id}/reset-password")\ndef reset_password(\n    user_id: int,\n    new_password: str,\n    db: Session = Depends(get_db),\n    current_user: User = Depends(get_current_librarian)\n):\n'
if old not in content:
    raise SystemExit('old endpoint signature not found')
new = '@router.post("/{user_id}/reset-password")\ndef reset_password(\n    user_id: int,\n    password_in: UserPasswordReset,\n    db: Session = Depends(get_db),\n    current_user: User = Depends(get_current_librarian)\n):\n'
content = content.replace(old, new, 1)
content = content.replace('user.hashed_password = get_password_hash(new_password)', 'user.hashed_password = get_password_hash(password_in.new_password)')
users_file.write_text(content, encoding='utf-8')
print('users endpoint updated')

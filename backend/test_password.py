import certifi
from pymongo import MongoClient
from dotenv import dotenv_values
from passlib.context import CryptContext

vals = dotenv_values('./.env')
uri = vals.get('MONGO_URI')

client = MongoClient(uri, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=20000)
db = client['zenvora_ai']
users = db['users']

pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")

# Find the admin user
user = users.find_one({'email': 'admin@zenvora.com'})
if user:
    password = 'Admin@123456'
    stored = user.get('password')
    
    print('Testing password verification:')
    print('  Password:', password)
    print('  Stored hash:', stored[:50] + '...')
    
    try:
        result = pwd_context.verify(password, stored)
        print('  Verification result:', result)
    except Exception as e:
        print('  Verification error:', str(e))
else:
    print('User not found')

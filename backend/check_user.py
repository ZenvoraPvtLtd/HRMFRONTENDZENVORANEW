import certifi
from pymongo import MongoClient
from dotenv import dotenv_values

vals = dotenv_values('./.env')
uri = vals.get('MONGO_URI')

client = MongoClient(uri, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=20000)
db = client['zenvora_ai']
users = db['users']

# Find the admin user
user = users.find_one({'email': 'admin@zenvora.com'})
if user:
    print('User found in zenvora_ai:')
    print('  ID:', user.get('_id'))
    print('  Email:', user.get('email'))
    print('  Role:', user.get('role'))
    pwd = user.get('password', '')
    print('  Password hash length:', len(pwd))
    print('  Password hash start:', pwd[:50] if len(pwd) > 50 else pwd)
else:
    print('User not found in zenvora_ai')
    # Check zenvora_hrm too
    db2 = client['zenvora_hrm']
    users2 = db2['users']
    user2 = users2.find_one({'email': 'admin@zenvora.com'})
    if user2:
        print('User found in zenvora_hrm')
        print('  ID:', user2.get('_id'))
        print('  Email:', user2.get('email'))
        print('  Role:', user2.get('role'))
    else:
        print('User not found in zenvora_hrm either')

import os
from pymongo import MongoClient
from dotenv import load_dotenv
from fastapi import HTTPException, status

load_dotenv()

MONGODB_URI = os.getenv(
    "MONGODB_URI",
    "mongodb://localhost:27017"
)

DATABASE_NAME = os.getenv(
    "DATABASE_NAME",
    "zenvora_ai"
)

COLLECTION_NAME = os.getenv(
    "COLLECTION_NAME",
    "parsed_resumes"
)

LEAVES_COLLECTION_NAME = os.getenv(
    "LEAVES_COLLECTION_NAME",
    "leaves"
)

LEAVE_BALANCES_COLLECTION_NAME = os.getenv(
    "LEAVE_BALANCES_COLLECTION_NAME",
    "leave_balances"
)

NOTIFICATIONS_COLLECTION_NAME = os.getenv(
    "NOTIFICATIONS_COLLECTION_NAME",
    "notifications"
)

CHAT_USERS_COLLECTION_NAME = os.getenv(
    "CHAT_USERS_COLLECTION_NAME",
    "chat_users"
)

CHAT_CONVERSATIONS_COLLECTION_NAME = os.getenv(
    "CHAT_CONVERSATIONS_COLLECTION_NAME",
    "chat_conversations"
)

CHAT_MESSAGES_COLLECTION_NAME = os.getenv(
    "CHAT_MESSAGES_COLLECTION_NAME",
    "chat_messages"
)

def connect_mongo(uri: str):
    mongo_client = MongoClient(
        uri,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
        socketTimeoutMS=None,
        retryWrites=True,
        w="majority",
        authSource="admin",
        maxPoolSize=50,
    )
    mongo_client.server_info()
    return mongo_client


def setup_collections(mongo_client):
    mongo_db = mongo_client[DATABASE_NAME]
    return {
        "db": mongo_db,
        "collection": mongo_db[COLLECTION_NAME],
        "jobs_collection": mongo_db["Jobs"],
        "leaves_collection": mongo_db[LEAVES_COLLECTION_NAME],
        "leave_balances_collection": mongo_db[LEAVE_BALANCES_COLLECTION_NAME],
        "notifications_collection": mongo_db[NOTIFICATIONS_COLLECTION_NAME],
        "chat_users_collection": mongo_db[CHAT_USERS_COLLECTION_NAME],
        "chat_conversations_collection": mongo_db[CHAT_CONVERSATIONS_COLLECTION_NAME],
        "chat_messages_collection": mongo_db[CHAT_MESSAGES_COLLECTION_NAME],
        "tasks_collection": mongo_db["Tasks"],
    }


def print_connection_success(source: str):
    print("[SUCCESS] MongoDB Connected Successfully!")
    print(f"   Source: {source}")
    print(f"   Database: {DATABASE_NAME}")
    print(f"   Collection: {COLLECTION_NAME}")
    print("   Jobs Collection: Jobs")
    print(f"   Leaves Collection: {LEAVES_COLLECTION_NAME}")
    print(f"   Leave Balances Collection: {LEAVE_BALANCES_COLLECTION_NAME}")
    print(f"   Notifications Collection: {NOTIFICATIONS_COLLECTION_NAME}")
    print(f"   Chat Users Collection: {CHAT_USERS_COLLECTION_NAME}")
    print(f"   Chat Conversations Collection: {CHAT_CONVERSATIONS_COLLECTION_NAME}")
    print(f"   Chat Messages Collection: {CHAT_MESSAGES_COLLECTION_NAME}")


client = None
db = None
collection = None
jobs_collection = None
leaves_collection = None
leave_balances_collection = None
notifications_collection = None
chat_users_collection = None
chat_conversations_collection = None
chat_messages_collection = None
tasks_collection = None

try:
    client = connect_mongo(MONGODB_URI)
    globals().update(setup_collections(client))
    print_connection_success("MONGODB_URI")

except Exception as e:

    print(
        f"[ERROR] Warning: MongoDB connection failed"
    )

    print(
        f"   Error: {str(e)}"
    )

    print(
        f"   Database: {DATABASE_NAME}"
    )

    print(
        f"   Collection: {COLLECTION_NAME}"
    )

    print(
        f"   Note: Check MongoDB Atlas - Allow Access from Anywhere (0.0.0.0/0) in Network Access settings"
    )

    fallback_uri = os.getenv("MONGODB_FALLBACK_URI", "mongodb://localhost:27017")
    if fallback_uri != MONGODB_URI:
        try:
            print(f"[INFO] Trying fallback MongoDB URI: {fallback_uri}")
            client = connect_mongo(fallback_uri)
            globals().update(setup_collections(client))
            print_connection_success("MONGODB_FALLBACK_URI/local MongoDB")
        except Exception as fallback_error:
            print("[ERROR] Fallback MongoDB connection failed")
            print(f"   Error: {str(fallback_error)}")


def get_database():
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is not connected. Check MONGODB_URI, MongoDB Compass/Atlas connection, and network access.",
        )
    return db


def is_database_connected():
    return db is not None

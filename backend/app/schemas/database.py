from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")
db = client["zenvora_hrm"]

project_collection = db["projects"]
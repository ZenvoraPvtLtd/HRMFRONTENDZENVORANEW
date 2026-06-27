from pymongo import MongoClient
import os
from dotenv import load_dotenv

def main():
    load_dotenv(override=True)
    uri = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI", "mongodb://localhost:27017")
    primary_dbname = os.getenv("DATABASE_NAME", "Zenvora-HRM")
    
    if not uri:
        print("MONGO_URI not found.")
        return

    # Use basic connection without TLS for local support
    client = MongoClient(uri, serverSelectionTimeoutMS=10000, connectTimeoutMS=10000)
    db = client[primary_dbname]
    col = db["employees_list"]

    employees = [
        {
            "name": "Sarah Connor",
            "email": "sarah@zenvora.com",
            "employeeId": "EMP001",
            "role": "CEO",
            "department": "Executive",
            "status": "Active"
        },
        {
            "name": "John Doe",
            "email": "john@zenvora.com",
            "employeeId": "EMP002",
            "role": "HR Manager",
            "department": "HR",
            "status": "Active"
        },
        {
            "name": "Jane Smith",
            "email": "jane@zenvora.com",
            "employeeId": "EMP003",
            "role": "Tech Lead",
            "department": "Tech Team",
            "status": "Active"
        },
        {
            "name": "Alice Johnson",
            "email": "alice@zenvora.com",
            "employeeId": "EMP004",
            "role": "Backend Developer",
            "department": "Tech Team",
            "status": "Active"
        },
        {
            "name": "Bob Williams",
            "email": "bob@zenvora.com",
            "employeeId": "EMP005",
            "role": "Frontend Developer",
            "department": "Tech Team",
            "status": "Active"
        }
    ]

    for emp in employees:
        col.update_one({"email": emp["email"]}, {"$set": emp}, upsert=True)
        
    print("Seeded employees in database!")

if __name__ == "__main__":
    main()

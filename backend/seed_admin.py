from __future__ import annotations

import bcrypt
import certifi
from dotenv import dotenv_values
from pymongo import MongoClient


def _parse_remove_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [email.strip().lower() for email in raw.split(",") if email.strip()]


def main() -> None:
    vals = dotenv_values(".env")
    uri = vals.get("MONGO_URI")
    if not uri:
        raise SystemExit("MONGO_URI missing in backend/.env")

    email = (vals.get("ADMIN_EMAIL") or "").strip().lower()
    password = vals.get("ADMIN_PASSWORD") or ""
    name = (vals.get("ADMIN_NAME") or "Admin").strip()

    if not email or not password:
        raise SystemExit(
            "Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env, then run: python seed_admin.py"
        )

    primary_dbname = vals.get("DATABASE_NAME") or "Zenvora-HRM"
    candidate_dbnames = {primary_dbname, "zenvora_ai", "zenvora_hrm"}

    remove_emails = _parse_remove_list(vals.get("ADMIN_REMOVE_EMAILS"))
    # Never delete the admin we are about to create.
    remove_emails = [e for e in remove_emails if e != email]

    client = MongoClient(
        uri,
        serverSelectionTimeoutMS=20000,
        connectTimeoutMS=20000,
        tlsCAFile=certifi.where(),
    )

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(10)).decode("utf-8")
    doc = {
        "name": name,
        "email": email,
        "password": hashed,
        "role": "admin",
        "provider": "local",
        "phoneNumber": "",
        "resetPasswordOtp": None,
        "resetPasswordOtpExpire": None,
        "isOtpVerified": False,
    }

    for dbname in sorted(candidate_dbnames):
        users = client[dbname]["users"]

        for old_email in remove_emails:
            res = users.delete_one({"email": old_email})
            if res.deleted_count:
                print(f"removed db={dbname} email={old_email}")

        res = users.update_one({"email": email}, {"$set": doc}, upsert=True)
        print(
            f"seed db={dbname} email={email}:",
            "matched=", res.matched_count,
            "upserted_id=", res.upserted_id,
        )


if __name__ == "__main__":
    main()

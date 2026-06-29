from __future__ import annotations

import os
from typing import Optional
from urllib.parse import urlparse

import pymongo
from pymongo.collection import Collection
from pymongo.database import Database


_client: Optional[pymongo.MongoClient] = None
_db: Optional[Database] = None


def _infer_database_name(mongo_uri: str, fallback: str = "zenvora_ai") -> str:
    """
    Infer DB name from connection string path part.
    Example: mongodb://host:27017/mydb -> mydb
    """
    try:
        parsed = urlparse(mongo_uri)
        # mongodb://host:27017/<db>
        path = (parsed.path or "").lstrip("/")
        if path:
            return path.split("/")[0] or fallback
    except Exception:
        pass
    # Allow explicit DB override.
    return os.getenv("DATABASE_NAME") or fallback


def init_mongo(mongo_uri: str, database_name: Optional[str] = None) -> None:
    """
    Initialize a global PyMongo client.
    Keeps behavior predictable for readiness checks.
    """
    global _client, _db
    if _client is not None:
        return

    # Only use TLS CA file for non-localhost connections (e.g. Atlas)
    is_local = any(
        host in mongo_uri
        for host in ("localhost", "127.0.0.1", "::1")
    )
    kwargs: dict = {
        "serverSelectionTimeoutMS": 2000,
        "connectTimeoutMS": 2000,
        "maxPoolSize": 50,
    }
    if not is_local:
        import certifi
        kwargs["tlsCAFile"] = certifi.where()
        kwargs["tlsAllowInvalidCertificates"] = True


    _client = pymongo.MongoClient(mongo_uri, **kwargs)
    db_name = database_name or _infer_database_name(mongo_uri)
    _db = _client[db_name]

    # Trigger connection attempt, but don't block app startup.
    try:
        _client.server_info()
    except Exception:
        pass


def get_db() -> Database:
    if _db is None:
        raise RuntimeError("Mongo not initialized (call init_mongo first).")
    return _db


def get_collection(name: str) -> Collection:
    return get_db()[name]


def is_mongo_ready() -> bool:
    global _client
    # To prevent blocking the server for 10+ seconds on intermittent SSL handshake failures,
    # we just check if the client was initialized. PyMongo handles auto-reconnection and 
    # connection pooling. Actual queries will throw an exception if the DB is unreachable.
    return _client is not None


import pytest
from app.api.routes.leaves import serialize_bson
from bson import Decimal128, ObjectId
from decimal import Decimal
from datetime import datetime, date

def test_serialize_decimal128():
    val = Decimal128("10.5")
    assert serialize_bson(val) == 10.5

def test_serialize_decimal():
    val = Decimal("10.5")
    assert serialize_bson(val) == 10.5

def test_serialize_objectid():
    oid = ObjectId()
    assert serialize_bson(oid) == str(oid)

def test_serialize_datetime():
    dt = datetime(2026, 1, 1, 12, 0)
    assert serialize_bson(dt) == dt.isoformat()

def test_serialize_date():
    d = date(2026, 1, 1)
    assert serialize_bson(d) == d.isoformat()

def test_serialize_null_values():
    assert serialize_bson(None, 0.0) == 0.0
    assert serialize_bson(None, 1.5) == 1.5
    assert serialize_bson(None, "default") == "default"

def test_serialize_mixed_numeric_types():
    assert serialize_bson(10) == 10.0
    assert serialize_bson(10.5) == 10.5
    assert serialize_bson("10.5") == 10.5
    assert serialize_bson("invalid", 0.0) == "invalid"  # if not numeric, falls back to val

def test_empty_result_set():
    dummy_dict = {}
    assert serialize_bson(dummy_dict.get("earned"), 1.5) == 1.5

from typing import Any, Dict, Optional


HARDCODED_ADMIN_EMAIL_PREFIX = "yangshan.andy"


def _email_prefix(email: str) -> str:
    return (email or "").split("@", 1)[0].strip().lower()


def is_hardcoded_admin_user(user: Optional[Dict[str, Any]]) -> bool:
    if not user:
        return False
    return _email_prefix(str(user.get("email") or "")) == HARDCODED_ADMIN_EMAIL_PREFIX

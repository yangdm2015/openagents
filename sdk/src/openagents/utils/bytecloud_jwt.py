"""ByteCloud JWT verification helpers for ByteDance SSO."""

from __future__ import annotations

import json
import time
import urllib.request
from typing import Any, Callable, Dict, Optional

import jwt
from jwt.exceptions import InvalidTokenError

BYTECLOUD_JWKS_URLS = {
    "online": "https://cloud.bytedance.net/auth/api/v1/jwks",
    "boe": "https://cloud-boe.bytedance.net/auth/api/v1/jwks",
}


class ByteCloudJwtError(ValueError):
    """Raised when a ByteCloud JWT cannot be verified."""


class ByteCloudJwtVerifier:
    """Verify ByteCloud user JWTs against ByteCloud JWKS."""

    def __init__(
        self,
        domain_id: str = "online",
        jwks_url: Optional[str] = None,
        jwks_loader: Optional[Callable[[str], Dict[str, Any]]] = None,
        cache_ttl_seconds: int = 300,
    ):
        self.domain_id = (domain_id or "online").lower()
        self.jwks_url = jwks_url or BYTECLOUD_JWKS_URLS.get(
            self.domain_id, BYTECLOUD_JWKS_URLS["online"]
        )
        self.jwks_loader = jwks_loader
        self.cache_ttl_seconds = cache_ttl_seconds
        self._jwks_cache: Optional[Dict[str, Any]] = None
        self._jwks_cache_expires_at = 0.0

    def _load_jwks(self) -> Dict[str, Any]:
        now = time.time()
        if self._jwks_cache and self._jwks_cache_expires_at > now:
            return self._jwks_cache
        if self.jwks_loader:
            jwks = self.jwks_loader(self.jwks_url)
        else:
            with urllib.request.urlopen(self.jwks_url, timeout=10) as response:
                jwks = json.loads(response.read().decode("utf-8"))
        if not isinstance(jwks, dict):
            raise ByteCloudJwtError("ByteCloud JWKS response is invalid")
        self._jwks_cache = jwks
        self._jwks_cache_expires_at = now + self.cache_ttl_seconds
        return jwks

    def _candidate_keys(self, token: str) -> list[Dict[str, Any]]:
        try:
            header = jwt.get_unverified_header(token)
        except InvalidTokenError as exc:
            raise ByteCloudJwtError(str(exc)) from exc
        kid = header.get("kid")
        alg = header.get("alg")
        if alg != "RS256":
            raise ByteCloudJwtError(f"unsupported ByteCloud JWT alg: {alg}")

        keys = self._load_jwks().get("keys") or []
        if not keys:
            raise ByteCloudJwtError("ByteCloud JWKS did not contain signing keys")
        candidates = [key for key in keys if kid and key.get("kid") == kid]
        return candidates or keys

    def verify(self, token: str) -> Dict[str, Any]:
        token = (token or "").strip()
        if not token:
            raise ByteCloudJwtError("ByteCloud JWT is required")

        last_error: Optional[Exception] = None
        for key_data in self._candidate_keys(token):
            try:
                public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key_data))
                claims = jwt.decode(
                    token,
                    public_key,
                    algorithms=["RS256"],
                    options={"verify_aud": False},
                )
                if not isinstance(claims, dict):
                    raise ByteCloudJwtError("ByteCloud JWT payload is invalid")
                if not (claims.get("username") or claims.get("email") or claims.get("sub") or claims.get("uuid")):
                    raise ByteCloudJwtError("ByteCloud JWT does not contain a user identity")
                return claims
            except (InvalidTokenError, ValueError) as exc:
                last_error = exc
                continue

        raise ByteCloudJwtError(str(last_error) if last_error else "ByteCloud JWT verification failed")


def claims_to_sso_profile(claims: Dict[str, Any]) -> Dict[str, Any]:
    username = (
        claims.get("username")
        or claims.get("preferred_username")
        or (str(claims.get("email", "")).split("@", 1)[0] if claims.get("email") else "")
        or claims.get("sub")
        or claims.get("uuid")
    )
    username = str(username or "").strip()
    email = str(claims.get("email") or "").strip().lower()
    if username and not email and "@" not in username:
        email = f"{username}@bytedance.com"
    return {
        "username": username,
        "email": email,
        "display_name": claims.get("display_name") or claims.get("name") or username,
        "organization": claims.get("organization"),
        "employee_id": claims.get("employee_id"),
        "uuid": claims.get("uuid"),
        "site": claims.get("site"),
        "region": claims.get("region"),
        "raw_claims": claims,
    }

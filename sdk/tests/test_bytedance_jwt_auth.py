import json
import time
import unittest

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

from openagents.utils.bytecloud_jwt import ByteCloudJwtError, ByteCloudJwtVerifier


def make_token(claims, kid="test-key"):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key()))
    public_jwk["kid"] = kid
    token = jwt.encode(
        claims,
        private_key,
        algorithm="RS256",
        headers={"kid": kid},
    )
    return token, {"keys": [public_jwk]}


class ByteCloudJwtVerifierTests(unittest.TestCase):
    def test_verifies_bytecloud_jwt_from_jwks(self):
        token, jwks = make_token(
            {
                "iss": "paas.passport.auth",
                "username": "yangshan.andy",
                "email": "yangshan.andy@bytedance.com",
                "organization": "Data",
                "employee_id": 123,
                "exp": int(time.time()) + 600,
                "iat": int(time.time()),
            }
        )
        verifier = ByteCloudJwtVerifier(
            domain_id="online",
            jwks_loader=lambda _url: jwks,
        )

        claims = verifier.verify(token)

        self.assertEqual(claims["username"], "yangshan.andy")
        self.assertEqual(claims["email"], "yangshan.andy@bytedance.com")


    def test_verifies_bytecloud_jwt_with_empty_kid(self):
        token, jwks = make_token(
            {
                "iss": "paas.passport.auth_oauth2",
                "username": "yangshan.andy",
                "email": "yangshan.andy@bytedance.com",
                "exp": int(time.time()) + 600,
                "iat": int(time.time()),
            },
            kid="",
        )
        verifier = ByteCloudJwtVerifier(
            domain_id="online",
            jwks_loader=lambda _url: jwks,
        )

        claims = verifier.verify(token)

        self.assertEqual(claims["username"], "yangshan.andy")

    def test_rejects_invalid_jwt(self):
        verifier = ByteCloudJwtVerifier(
            domain_id="online",
            jwks_loader=lambda _url: {"keys": []},
        )

        with self.assertRaises(ByteCloudJwtError):
            verifier.verify("not-a-jwt")


if __name__ == "__main__":
    unittest.main()

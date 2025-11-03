# app/services/liveness_challenges.py

"""
Liveness Challenge Generation and Validation.
Handles challenge generation, validation, and security features.
Adapted from face_liveness_detection-Anti-spoofing/questions.py
Enhanced with security features (HMAC, nonce, timestamp).
"""

import random
import hashlib
import hmac
import time
import uuid
import threading
from typing import Dict, Optional, List, Tuple, Any
from enum import Enum
from datetime import datetime, timedelta

from configs.config import config
from utils.logger import get_logger

logger = get_logger(__name__, log_file="liveness.log")


class ChallengeType(str, Enum):
    """Types of liveness challenges."""
    BLINK = "blink"
    TURN_LEFT = "turn_left"
    TURN_RIGHT = "turn_right"
    # Note: Emotion-based challenges (smile, surprise, angry) are skipped for MVP
    # due to TensorFlow 1.x model incompatibility


class ChallengeStatus(str, Enum):
    """Challenge validation status."""
    PASS = "pass"
    FAIL = "fail"
    PENDING = "pending"
    EXPIRED = "expired"
    INVALID = "invalid"


class LivenessChallenge:
    """Represents a single liveness challenge."""
    
    def __init__(
        self,
        challenge_id: str,
        challenge_type: ChallengeType,
        question_text: str,
        timestamp: float,
        nonce: str,
        signature: Optional[str] = None,
        expires_in: int = 30  # seconds
    ):
        self.challenge_id = challenge_id
        self.challenge_type = challenge_type
        self.question_text = question_text
        self.timestamp = timestamp
        self.nonce = nonce
        self.signature = signature
        self.expires_at = timestamp + expires_in
        self.status = ChallengeStatus.PENDING
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert challenge to dictionary for API response."""
        return {
            "challenge_id": self.challenge_id,
            "challenge_type": self.challenge_type.value,
            "question": self.question_text,
            "instruction": self._get_instruction(),
            "timestamp": self.timestamp,
            "expires_at": self.expires_at,
            "nonce": self.nonce,
            "signature": self.signature
        }
    
    def _get_instruction(self) -> str:
        """Get user-friendly instruction text."""
        instructions = {
            ChallengeType.BLINK: "Blink your eyes once",
            ChallengeType.TURN_LEFT: "Turn your face to the left",
            ChallengeType.TURN_RIGHT: "Turn your face to the right"
        }
        return instructions.get(self.challenge_type, self.question_text)
    
    def is_expired(self) -> bool:
        """Check if challenge has expired."""
        return time.time() > self.expires_at
    
    def verify_signature(self, secret_key: str) -> bool:
        """Verify HMAC signature of challenge."""
        if not self.signature:
            return False
        
        expected_signature = self._generate_signature(secret_key)
        return hmac.compare_digest(self.signature, expected_signature)
    
    def _generate_signature(self, secret_key: str) -> str:
        """Generate HMAC signature for challenge."""
        message = f"{self.challenge_id}:{self.challenge_type.value}:{self.timestamp}:{self.nonce}"
        signature = hmac.new(
            secret_key.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return signature


class ChallengeGenerator:
    """
    Generates and manages liveness challenges.
    """
    
    # Question bank - excluding emotion challenges for MVP
    CHALLENGE_TYPES = [
        ChallengeType.BLINK,
        ChallengeType.TURN_LEFT,
        ChallengeType.TURN_RIGHT
    ]
    
    QUESTION_TEXTS = {
        ChallengeType.BLINK: "blink eyes",
        ChallengeType.TURN_LEFT: "turn face left",
        ChallengeType.TURN_RIGHT: "turn face right"
    }
    
    def __init__(self, secret_key: Optional[str] = None, expires_in: Optional[int] = None):
        """
        Initialize challenge generator.
        
        Args:
            secret_key: Secret key for HMAC signing (uses config if None)
            expires_in: Challenge expiration time in seconds (uses config if None)
        """
        if secret_key is None:
            secret_key = config.get("liveness", "security", "hmac_secret", default="change-me-in-production")
        
        if expires_in is None:
            expires_in = config.get("liveness", "challenge", "expires_in", default=120)
        
        self.secret_key = secret_key
        self.expires_in = expires_in
        
        # In-memory challenge storage (for validation)
        # In production, consider Redis or database
        self._active_challenges: Dict[str, LivenessChallenge] = {}
        
        logger.info(f"ChallengeGenerator initialized (expires_in: {expires_in}s)")
    
    def generate_challenge(self, challenge_type: Optional[ChallengeType] = None) -> LivenessChallenge:
        """
        Generate a new liveness challenge.
        
        Args:
            challenge_type: Specific challenge type, or None for random
        
        Returns:
            LivenessChallenge object
        """
        if challenge_type is None:
            challenge_type = random.choice(self.CHALLENGE_TYPES)
        
        challenge_id = str(uuid.uuid4())
        timestamp = time.time()
        nonce = uuid.uuid4().hex
        
        challenge = LivenessChallenge(
            challenge_id=challenge_id,
            challenge_type=challenge_type,
            question_text=self.QUESTION_TEXTS[challenge_type],
            timestamp=timestamp,
            nonce=nonce,
            expires_in=self.expires_in
        )
        
        # Generate signature
        challenge.signature = challenge._generate_signature(self.secret_key)
        
        # Store for validation
        self._active_challenges[challenge_id] = challenge
        
        logger.info(f"Generated challenge: {challenge_type.value} (ID: {challenge_id})")
        
        return challenge
    
    def generate_multiple(self, count: int, allow_duplicates: bool = False) -> List[LivenessChallenge]:
        """
        Generate multiple challenges.
        
        Args:
            count: Number of challenges to generate
            allow_duplicates: If False, ensures unique challenge types
        
        Returns:
            List of LivenessChallenge objects
        """
        challenges = []
        used_types = set()
        
        for _ in range(count):
            if not allow_duplicates and len(used_types) >= len(self.CHALLENGE_TYPES):
                # Reset if we've used all types
                used_types.clear()
            
            challenge_type = None
            while challenge_type is None or (not allow_duplicates and challenge_type in used_types):
                challenge_type = random.choice(self.CHALLENGE_TYPES)
            
            if not allow_duplicates:
                used_types.add(challenge_type)
            
            challenge = self.generate_challenge(challenge_type)
            challenges.append(challenge)
        
        return challenges
    
    def validate_challenge(self, challenge_id: str) -> Tuple[bool, Optional[LivenessChallenge]]:
        """
        Validate and retrieve challenge.
        
        Args:
            challenge_id: Challenge ID to validate
        
        Returns:
            Tuple of (is_valid, challenge)
        """
        challenge = self._active_challenges.get(challenge_id)
        
        if challenge is None:
            logger.warning(f"Challenge not found: {challenge_id}")
            return False, None
        
        if challenge.is_expired():
            logger.warning(f"Challenge expired: {challenge_id}")
            self._active_challenges.pop(challenge_id, None)
            return False, None
        
        if not challenge.verify_signature(self.secret_key):
            logger.warning(f"Challenge signature invalid: {challenge_id}")
            return False, None
        
        return True, challenge
    
    def validate_response(
        self,
        challenge_id: str,
        detection_results: Dict[str, Any]
    ) -> Tuple[ChallengeStatus, Optional[str]]:
        """
        Validate challenge response based on detection results.
        
        Args:
            challenge_id: Challenge ID
            detection_results: Dictionary with:
                - blinks: int (number of blinks detected)
                - orientation: str ('left', 'right', or None)
                - face_detected: bool
        
        Returns:
            Tuple of (status, message)
        """
        is_valid, challenge = self.validate_challenge(challenge_id)
        
        if not is_valid or challenge is None:
            return ChallengeStatus.INVALID, "Challenge not found or expired"
        
        if challenge.is_expired():
            self._active_challenges.pop(challenge_id, None)
            return ChallengeStatus.EXPIRED, "Challenge expired"
        
        # Validate based on challenge type
        if challenge.challenge_type == ChallengeType.BLINK:
            blinks = detection_results.get("blinks", 0)
            if blinks >= 1:
                challenge.status = ChallengeStatus.PASS
                self._active_challenges.pop(challenge_id, None)
                return ChallengeStatus.PASS, "Blink detected successfully"
            else:
                return ChallengeStatus.FAIL, "No blink detected"
        
        elif challenge.challenge_type == ChallengeType.TURN_LEFT:
            orientation = detection_results.get("orientation")
            if orientation == "left":
                challenge.status = ChallengeStatus.PASS
                self._active_challenges.pop(challenge_id, None)
                return ChallengeStatus.PASS, "Left orientation detected"
            else:
                return ChallengeStatus.FAIL, f"Expected left, got {orientation}"
        
        elif challenge.challenge_type == ChallengeType.TURN_RIGHT:
            orientation = detection_results.get("orientation")
            if orientation == "right":
                challenge.status = ChallengeStatus.PASS
                self._active_challenges.pop(challenge_id, None)
                return ChallengeStatus.PASS, "Right orientation detected"
            else:
                return ChallengeStatus.FAIL, f"Expected right, got {orientation}"
        
        return ChallengeStatus.INVALID, "Unknown challenge type"
    
    def cleanup_expired(self) -> int:
        """
        Clean up expired challenges.
        
        Returns:
            Number of challenges removed
        """
        current_time = time.time()
        expired_ids = [
            cid for cid, challenge in self._active_challenges.items()
            if challenge.expires_at < current_time
        ]
        
        for cid in expired_ids:
            self._active_challenges.pop(cid, None)
        
        if expired_ids:
            logger.info(f"Cleaned up {len(expired_ids)} expired challenges")
        
        return len(expired_ids)
    
    def get_challenge_count(self) -> int:
        """Get number of active challenges."""
        return len(self._active_challenges)


# ============================================================================
# Singleton Pattern
# ============================================================================

_generator_instance: Optional[ChallengeGenerator] = None
_generator_lock = threading.Lock()


def get_challenge_generator() -> ChallengeGenerator:
    """Get or create singleton ChallengeGenerator instance. Thread-safe."""
    global _generator_instance
    
    if _generator_instance is None:
        with _generator_lock:
            if _generator_instance is None:
                _generator_instance = ChallengeGenerator()
                logger.info("ChallengeGenerator singleton created")
    
    return _generator_instance


# ============================================================================
# Helper Functions (for backward compatibility with original repo)
# ============================================================================

def question_bank(index: int) -> str:
    """
    Get question text by index (backward compatibility).
    
    Args:
        index: Question index (0-2 for MVP: blink, turn_left, turn_right)
    
    Returns:
        Question text string
    """
    questions = [
        "blink eyes",
        "turn face left",
        "turn face right"
    ]
    
    if 0 <= index < len(questions):
        return questions[index]
    else:
        raise ValueError(f"Invalid question index: {index}")


def challenge_result(
    question: str,
    detection_results: Dict[str, Any],
    blinks_up: int = 0
) -> str:
    """
    Validate challenge result (backward compatibility).
    
    Args:
        question: Question text
        detection_results: Detection results dictionary
        blinks_up: Number of blinks detected (1 = blink, 0 = no blink)
    
    Returns:
        "pass" or "fail"
    """
    if question == "blink eyes":
        if blinks_up >= 1:
            return "pass"
        else:
            return "fail"
    
    elif question == "turn face left":
        orientation = detection_results.get("orientation", [])
        if isinstance(orientation, list):
            orientation = orientation[0] if len(orientation) > 0 else None
        if orientation == "left":
            return "pass"
        else:
            return "fail"
    
    elif question == "turn face right":
        orientation = detection_results.get("orientation", [])
        if isinstance(orientation, list):
            orientation = orientation[0] if len(orientation) > 0 else None
        if orientation == "right":
            return "pass"
        else:
            return "fail"
    
    return "fail"


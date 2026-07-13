//! LogosWire: Bincode-based wire serialization for P2P messaging.
//!
//! Provides a simple abstraction over bincode for encoding/decoding
//! messages on the wire. Designed for easy future migration to rkyv
//! if zero-copy performance becomes necessary.

use serde::{de::DeserializeOwned, Serialize};
use std::fmt;

/// Error type for wire serialization/deserialization.
#[derive(Debug, Clone)]
pub enum WireError {
    /// Failed to encode message to bytes
    Encode(String),
    /// Failed to decode bytes to message
    Decode(String),
}

impl fmt::Display for WireError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Encode(msg) => write!(f, "Wire encode error: {}", msg),
            Self::Decode(msg) => write!(f, "Wire decode error: {}", msg),
        }
    }
}

impl std::error::Error for WireError {}

/// Encode a serializable message to bytes.
///
/// # Example
/// ```
/// use serde::{Serialize, Deserialize};
/// use logicaffeine_system::network::wire;
///
/// #[derive(Serialize, Deserialize, PartialEq, Debug)]
/// struct Ping { id: u32 }
///
/// let msg = Ping { id: 42 };
/// let bytes = wire::encode(&msg).unwrap();
/// let decoded: Ping = wire::decode(&bytes).unwrap();
/// assert_eq!(msg, decoded);
/// ```
pub fn encode<T: Serialize>(msg: &T) -> Result<Vec<u8>, WireError> {
    bincode::serialize(msg).map_err(|e| WireError::Encode(e.to_string()))
}

/// Decode bytes to a deserializable message.
pub fn decode<T: DeserializeOwned>(bytes: &[u8]) -> Result<T, WireError> {
    bincode::deserialize(bytes).map_err(|e| WireError::Decode(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};

    #[derive(Serialize, Deserialize, PartialEq, Debug)]
    struct TestMessage {
        id: u32,
        content: String,
    }

    #[test]
    fn test_roundtrip() {
        let msg = TestMessage {
            id: 42,
            content: "hello mesh".to_string(),
        };
        let bytes = encode(&msg).unwrap();
        let decoded: TestMessage = decode(&bytes).unwrap();
        assert_eq!(msg, decoded);
    }

    #[test]
    fn test_decode_invalid_bytes() {
        let bytes = vec![0xFF, 0xFF, 0xFF];
        let result: Result<TestMessage, _> = decode(&bytes);
        assert!(result.is_err());
    }

    /// `encode` must produce the message's real, content-dependent bytes — not a constant. Kills
    /// the `encode -> Ok(vec![])` / `vec![0]` / `vec![1]` mutants (a gutted encoder returns a fixed
    /// short vec that neither round-trips nor distinguishes distinct messages).
    #[test]
    fn encode_is_content_dependent_and_round_trips() {
        let msg = TestMessage { id: 0xDEAD_BEEF, content: "the quick brown fox".to_string() };
        let bytes = encode(&msg).unwrap();
        assert!(bytes.len() > 3, "encoding too short to be a real serialization: {bytes:?}");
        let back: TestMessage = decode(&bytes).unwrap();
        assert_eq!(msg, back);
        // Distinct messages must encode to distinct bytes (a constant encoder fails this).
        let other = TestMessage { id: 1, content: "x".to_string() };
        assert_ne!(encode(&other).unwrap(), bytes, "distinct messages encoded identically");
    }

    /// The `Display` for `WireError` must name its kind and carry its cause — kills the
    /// `fmt -> Ok(Default::default())` mutant (which would write nothing).
    #[test]
    fn wire_error_display_names_kind_and_cause() {
        let s = format!("{}", WireError::Encode("boom".to_string()));
        assert!(s.contains("encode") && s.contains("boom"), "encode error display: {s:?}");
        let d = format!("{}", WireError::Decode("bad-frame".to_string()));
        assert!(d.contains("decode") && d.contains("bad-frame"), "decode error display: {d:?}");
    }
}

---
"motiontext-renderer": minor
---

feat: implement track-based boxStyle inheritance system

- Split Style interface into TextStyle and BoxStyle for better separation of concerns
- Add defaultBoxStyle to Track type for group node styling defaults
- Implement boxStyle inheritance only for group nodes (text nodes inherit text styles only)
- Add backward compatibility for legacy combined styles with automatic splitting
- Update RendererV2 to use separate text and box style application functions
- Add comprehensive test suite for boxStyle inheritance scenarios
- Create demo sample showcasing boxStyle inheritance across multiple cues

This enables track-level box styling management where group nodes inherit box styles from their track while text nodes only inherit text styles, allowing for consistent container styling with individual group customization when needed.
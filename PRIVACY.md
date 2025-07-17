# Privacy Policy

**Effective Date:** January 18, 2025  
**Last Updated:** January 18, 2025

## Our Commitment to Your Privacy

ShadowHawk Password Manager is built with privacy as our foundation. We believe that your personal data belongs to you, and you alone should control it. This privacy policy explains how we protect your information and outlines our commitment to keeping your data secure and private.

## TL;DR - The Short Version

- **We collect ZERO personal data** - Your passwords never leave your device
- **No tracking, no analytics, no data mining** - We don't know what you store
- **100% local storage** - Everything stays on your computer
- **No accounts required** - No servers, no cloud storage, no data transmission
- **Open source transparency** - You can verify our claims by reviewing our code

## Zero-Knowledge Architecture

### What This Means
ShadowHawk operates on a **zero-knowledge security model**, which means:

- We cannot see your passwords, even if we wanted to
- We don't know what websites you use
- We have no access to your vault contents
- We cannot recover your data if you lose your master password
- There are no "backdoors" or recovery mechanisms that could compromise your security

### How It Works
1. **Local Encryption**: All data is encrypted on your device using AES-256 encryption
2. **Master Password**: Your master password is the only key to your vault
3. **No Network Communication**: The application doesn't send any data over the internet
4. **Offline Operation**: Works completely offline - no internet connection required

## Data We Do NOT Collect

We want to be crystal clear about what we **don't** collect:

- ❌ Your passwords or any vault contents
- ❌ Your personal information (name, email, address)
- ❌ Your browsing habits or website usage
- ❌ Device identifiers or hardware information
- ❌ Usage analytics or telemetry data
- ❌ Crash reports or error logs
- ❌ Any form of tracking data

## Data We DO Handle (Locally Only)

The following data is processed and stored **locally on your device only**:

### Vault Data
- **Encrypted passwords** - Stored in local files, encrypted with your master password
- **Website information** - URLs and usernames you choose to save
- **Folder organization** - Custom categories you create
- **Application settings** - Your preferences for themes, language, and password generation

### Application Preferences
- **Language settings** - Automatically detected from your system
- **Theme preferences** - Light/dark mode selection
- **Password generation rules** - Length, character sets, and complexity settings
- **Window positioning** - Size and position of the application window

## Automatic Language Detection

ShadowHawk includes intelligent language detection that:

- **Detects your system language** using standard browser APIs
- **Works completely offline** - no external services or data transmission
- **Respects your privacy** - language detection happens locally
- **No data collection** - we don't store or transmit language preferences

Supported languages: English, Polish, Spanish, German, French, and Portuguese.

## Import/Export Security

### Secure Export System
When you export your vault:
- Data is encrypted with a unique export code
- Export codes are generated locally using cryptographic random numbers
- No export data is transmitted or stored by us
- You maintain complete control over your exported data

### Import Process
- Import codes are processed locally on your device
- No data is sent to external servers during import
- All decryption happens on your device

## Third-Party Services

**We use NO third-party services that could compromise your privacy:**

- ❌ No analytics services (Google Analytics, etc.)
- ❌ No crash reporting services
- ❌ No advertising networks
- ❌ No social media integrations
- ❌ No external APIs or web services
- ❌ No content delivery networks for tracking

## Technical Security Measures

### Encryption
- **AES-256 encryption** - Military-grade security standard
- **PBKDF2 key derivation** - Protection against brute force attacks
- **Local key generation** - Encryption keys never leave your device
- **Secure random number generation** - For passwords and cryptographic operations

### Data Storage
- **Local file storage** - Data stored in encrypted files on your device
- **No cloud synchronization** - Prevents data interception
- **Secure deletion** - Deleted items are cryptographically erased
- **Memory protection** - Sensitive data cleared from memory after use

## Your Rights and Control

Since we don't collect your data, traditional privacy rights don't apply in the usual sense. However, you have complete control:

### Complete Data Ownership
- **Full control** - You own and control all your data
- **No external dependencies** - Your data doesn't rely on our services
- **Portable** - Export and move your data anytime
- **Deletable** - Remove the application and all data is gone

### Transparency
- **Open source code** - You can inspect our privacy practices
- **No hidden functionality** - All features are visible and documented
- **Community review** - Our code is available for security audits

## Updates and Changes

### How We Handle Updates
- **No automatic data collection** during updates
- **No usage tracking** for update analytics
- **Local update checks** - No personal data transmitted
- **Transparent changelog** - All changes documented publicly

### Privacy Policy Changes
If we ever need to update this privacy policy:
- We will update the "Last Updated" date
- Major changes will be highlighted in our changelog
- You will always maintain the same level of privacy protection

## Compliance and Standards

### Security Standards
- Follows industry best practices for password management
- Implements OWASP security guidelines
- Uses proven cryptographic algorithms
- Regular security reviews and updates

### Open Source Compliance
- Code available for public review
- Transparent development process
- Community-driven security improvements
- No hidden functionality or backdoors

## Contact and Transparency

### Questions About Privacy
If you have questions about our privacy practices:
- Review our open source code for technical details
- Check our documentation for implementation specifics
- Join our community discussions for clarification

### Reporting Security Issues
If you discover a security vulnerability:
- Report through our GitHub repository
- We will address security issues promptly
- All security fixes will be transparent and documented

## Verification

### How to Verify Our Claims
You can verify our privacy practices by:

1. **Reviewing our source code** - Available on GitHub
2. **Network monitoring** - Use tools to verify no data transmission
3. **File system monitoring** - Confirm data stays local
4. **Code audits** - Independent security reviews welcome

### Community Verification
- Open source community can review our code
- Security researchers can audit our practices
- Transparent development process
- Public discussion of security and privacy features

## Conclusion

ShadowHawk Password Manager is designed with one principle in mind: **your privacy is non-negotiable**. We've built an application that doesn't just protect your passwords—it protects your privacy by design.

By choosing a zero-knowledge, offline-first architecture, we've eliminated the most common privacy risks associated with password managers. Your data never leaves your device, we never see your information, and you maintain complete control.

This isn't just a privacy policy—it's our promise to you.

---

**Questions?** Check out our [FAQ](README.md) or review our [source code](https://github.com/Klucznik6/ShadowHawk-passwords-manager) for technical implementation details.

**Security Researchers:** We welcome security audits and responsible disclosure of any vulnerabilities you may find.

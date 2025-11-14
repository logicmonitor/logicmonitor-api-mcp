# Security Policy

## Supported Versions

Users are strongly encouraged to upgrade to the latest version of the LogicMonitor API MCP Server as updates become available. All reported bugs and security issues are thoroughly evaluated and promptly addressed to ensure the highest level of system integrity and reliability.

| Version | Supported          |
| ------- | ------------------ |
| Latest Release   | :white_check_mark: |
| Previous Releases   | :x:                |

## Reporting a Vulnerability

We take the security of our software seriously. If you believe you have found a security vulnerability in this MCP server, we encourage you to let us know right away. We will investigate all legitimate reports and do our best to quickly fix the problem.

Please follow these steps to report a vulnerability:

1. **Report security vulnerabilities through the public GitHub issues at [https://github.com/LogicMonitor/lm-api-mcp/issues](https://github.com/LogicMonitor/lm-api-mcp/issues).**
2. Include the following details:
   - Description of the vulnerability.
   - Steps to reproduce. This is incredibly important for us to be able to reproduce your findings.
   - Impact of the issue, including how you believe it can be exploited.
   - Affected versions (if known).
3. Please give us a reasonable amount of time to respond to your report before making public any information about the reported issue.
4. If you'd like, include how you would like to be acknowledged. We are more than happy to give credit where credit is due.

## Security Update Policy

When a vulnerability is discovered and a fix is available, updates will be applied as soon as possible. Security patches will be released as minor or patch versions depending on severity.

Stay up-to-date by:
- Watching this repository for releases
- Running `npm update -g logicmonitor-api-mcp` regularly
- Subscribing to release notifications on GitHub

## Security Best Practices

When using the LogicMonitor API MCP Server:

### Credential Management
- **Never commit credentials** to version control
- Use environment variables or secure credential stores
- Rotate API tokens regularly
- Use the minimum required permissions for API tokens

### Deployment
- **STDIO mode**: Credentials are passed via environment variables and never stored
- **HTTP mode**: Use HTTPS in production environments
- **Network security**: Restrict access to the MCP server port when using HTTP mode
- **Authentication**: When using HTTP mode, prefer passing credentials per-request via headers rather than server-side environment variables

### Updates
- Keep the MCP server updated to the latest version
- Review release notes for security-related changes
- Test updates in a non-production environment first

## Known Security Considerations

### API Token Security
This MCP server requires LogicMonitor API credentials to function. These credentials provide access to your LogicMonitor account. Protect them accordingly:

- Use Bearer tokens (recommended) rather than API key/secret pairs when possible
- Implement the principle of least privilege
- Monitor API token usage through LogicMonitor's audit logs

### Rate Limiting
The server implements rate limiting to prevent abuse. However, ensure your deployment environment has appropriate network-level protections.

### Input Validation
All user inputs are validated using Joi schemas. However, always validate data at multiple layers when building integrations.

## Contact

For urgent or sensitive security reports, you can also contact the repository maintainer at [steven.villardi@logicmonitor.com](mailto:steven.villardi@logicmonitor.com).

For general security inquiries about LogicMonitor products, please visit [https://www.logicmonitor.com/security](https://www.logicmonitor.com/security).

Thank you for helping keep the LogicMonitor API MCP Server and its users safe!

---

**Note**: This project is licensed under the Mozilla Public License 2.0 (MPL-2.0). See the [LICENSE](LICENSE) file for details.


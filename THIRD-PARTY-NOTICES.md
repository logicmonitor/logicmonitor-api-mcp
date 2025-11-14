# Third-Party Notices

This project uses third-party software components that are licensed under various open-source licenses. All dependencies use permissive licenses that are compatible with the Mozilla Public License 2.0 (MPL-2.0).

## License Summary

The following table summarizes the licenses used by this project's dependencies:

| License Type | Count | Compatibility with MPL-2.0 |
|-------------|-------|---------------------------|
| MIT | 114 packages | ✅ Compatible |
| BSD-3-Clause | 7 packages | ✅ Compatible |
| BSD-2-Clause | 2 packages | ✅ Compatible |
| ISC | 7 packages | ✅ Compatible |

## Direct Dependencies

### Production Dependencies

| Package | Version | License | Repository |
|---------|---------|---------|------------|
| @modelcontextprotocol/sdk | 1.20.2 | MIT | https://github.com/modelcontextprotocol/typescript-sdk |
| axios | 1.13.0 | MIT | https://github.com/axios/axios |
| dotenv | 16.6.1 | BSD-2-Clause | https://github.com/motdotla/dotenv |
| express | 5.1.0 | MIT | https://github.com/expressjs/express |
| helmet | 8.1.0 | MIT | https://github.com/helmetjs/helmet |
| joi | 17.13.3 | BSD-3-Clause | https://github.com/hapijs/joi |
| winston | 3.18.3 | MIT | https://github.com/winstonjs/winston |

## License Texts

### MIT License

The MIT License is a permissive free software license that allows for reuse within proprietary software provided that all copies include the original copyright and license notice.

**Key permissions:**
- Commercial use
- Modification
- Distribution
- Private use

**Conditions:**
- License and copyright notice must be included

### BSD-3-Clause License

The BSD 3-Clause License is a permissive free software license that allows redistribution and use in source and binary forms, with or without modification.

**Key permissions:**
- Commercial use
- Modification
- Distribution
- Private use

**Conditions:**
- License and copyright notice must be included
- Cannot use contributors' names for endorsement without permission

### BSD-2-Clause License

Similar to BSD-3-Clause but without the non-endorsement clause.

**Key permissions:**
- Commercial use
- Modification
- Distribution
- Private use

**Conditions:**
- License and copyright notice must be included

### ISC License

The ISC License is functionally equivalent to the MIT License and BSD 2-Clause License, with language that is considered simpler.

**Key permissions:**
- Commercial use
- Modification
- Distribution
- Private use

**Conditions:**
- License and copyright notice must be included

## Compatibility Statement

All third-party dependencies used in this project are licensed under permissive open-source licenses (MIT, BSD-2-Clause, BSD-3-Clause, ISC) that are compatible with the Mozilla Public License 2.0 (MPL-2.0) under which this project is licensed.

The MPL-2.0 is a "weak copyleft" license that applies at the file level:
- Files licensed under MPL-2.0 must remain under MPL-2.0
- You can combine MPL-2.0 files with files under other licenses (including proprietary) in the same project
- Dependencies under permissive licenses (MIT, BSD, ISC) retain their original licenses

## Full Dependency List

For a complete list of all dependencies (including transitive dependencies) and their licenses, you can run:

```bash
npx license-checker --production --json
```

This will generate a detailed report of all packages used in production.

## Reporting Issues

If you believe any dependency license information is incorrect or if you have concerns about license compatibility, please open an issue at:
https://github.com/LogicMonitor/lm-api-mcp/issues

---

*Last updated: November 14, 2025*


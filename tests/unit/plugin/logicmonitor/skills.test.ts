import fs from 'node:fs';
import path from 'node:path';

describe('logicmonitor plugin skills contract', () => {
  const skillsRoot = path.resolve('plugins/logicmonitor/skills');
  const expectedSkills = [
    'safe-usage/SKILL.md',
    'session-and-portal/SKILL.md',
    'setup-and-doctor/SKILL.md',
  ];
  const disallowed = ['operation: "list"', 'fields?: string', 'resource-based tools'];

  it('ships exactly the phase-one skills', () => {
    const actual = fs.existsSync(skillsRoot)
      ? fs.readdirSync(skillsRoot)
          .sort()
          .map(name => `${name}/SKILL.md`)
      : [];

    expect(actual).toEqual(expectedSkills);
  });

  it('references repo truths without duplicating tool schema tables', () => {
    for (const skillPath of expectedSkills) {
      const absolutePath = path.join(skillsRoot, skillPath);
      expect(fs.existsSync(absolutePath)).toBe(true);

      const body = fs.readFileSync(absolutePath, 'utf8');
      expect(body).toMatch(/README\.md|AGENTS\.md|tests\/README\.md|src\//);

      for (const token of disallowed) {
        expect(body).not.toContain(token);
      }
    }
  });
});

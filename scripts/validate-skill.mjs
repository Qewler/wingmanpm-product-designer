import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? process.cwd());
const skillFile = path.join(root, 'SKILL.md');
const content = await readFile(skillFile, 'utf8');
if (!content.startsWith('---\n')) throw new Error('SKILL.md needs YAML frontmatter.');
const end = content.indexOf('\n---\n', 4);
if (end < 0) throw new Error('SKILL.md frontmatter is not closed.');
const frontmatter = content.slice(4, end);
for (const field of ['name:', 'description:', 'license:']) {
  if (!frontmatter.includes(`\n${field}`) && !frontmatter.startsWith(field)) throw new Error(`SKILL.md is missing ${field}`);
}
const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim();
if (!/^[a-z0-9-]{1,64}$/.test(name ?? '')) throw new Error('Skill name must use lowercase letters, numbers, and hyphens.');
const links = [...content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]).filter((link) => !link.includes('://'));
for (const link of links) await stat(path.resolve(root, link));
console.log(`Skill validation passed: ${name}; ${links.length} local references resolved.`);

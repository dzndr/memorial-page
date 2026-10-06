import { hashPassword } from '../src/lib/auth.mjs';
if (!process.stdin.isTTY) throw new Error('Bitte interaktiv in einem Terminal ausführen');
async function prompt(label) {
  process.stderr.write(label);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const handler = chunk => {
      for (const char of chunk.toString()) {
        if (char === '\u0003') { cleanup(); reject(new Error('Abgebrochen')); return; }
        if (char === '\r' || char === '\n') { cleanup(); resolve(value); return; }
        if (char === '\u007f') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    };
    function cleanup() { process.stdin.off('data', handler); process.stdin.setRawMode(false); process.stdin.pause(); process.stderr.write('\n'); }
    process.stdin.on('data', handler);
  });
}
const password = await prompt('Passwort: ');
const confirmation = await prompt('Passwort wiederholen: ');
if (!password || password !== confirmation || Buffer.byteLength(password) > 1024) throw new Error('Passwörter müssen übereinstimmen und 1–1024 Bytes lang sein');
console.log(await hashPassword(password));

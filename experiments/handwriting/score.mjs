// Scores a transcription of whiteboard page 2 against 22 checkpoints written by hand from the page.
import { readFileSync } from 'node:fs';
const C = [
 ['example n=4', /example[\s\S]{0,25}\bn\s*=\s*4/i], ['known row&column start@1', /row\s*(&|and)\s*colu?m?n?[\s\S]{0,40}start[\s\S]{0,15}value\s*=?\s*1/i],
 ['ans/solution', /ans\w*\s*\/\s*solution/i], ['int main()', /int\s+main\s*\(\s*\)/], ['int n = 4;', /int\s+n\s*=\s*4\s*;/],
 ['for i', /for\s*\(\s*int\s+i\s*=\s*1\s*;\s*i\s*<=\s*n\s*;\s*i\s*\+\+\s*\)/], ['for j', /for\s*\(\s*int\s+j\s*=\s*1\s*;\s*j\s*<=\s*n\s*;\s*j\s*(\+\+|\+1)\s*\)/],
 ['if (j<=i)', /if\s*\(\s*j\s*<=\s*i\s*\)/], ['printf("*")', /printf\s*\(\s*"\*"\s*\)/], ['else', /\belse\b/], ['break;', /break\s*;/],
 ['printf("\\n")', /printf\s*\(\s*"\\n"\s*\)/], ['return 0', /return\s*0/], ['right angle triangle', /right[\s-]*angle(d)?\s*triangle/i],
 ['col <= row rule', /less\s+than\s+or\s+equal\s+to\s+(the\s+)?row\s+value/i], ['TRACE TABLE', /trace\s*table/i], ['Assumption', /assumption/i],
 ['outer loop = row', /outer\s*loop\s*=\s*row/i], ['inner loop = column', /inner\s*loop\s*=\s*colu?m?n?/i], ['cond 1<=1 & 2<=1', /1\s*<=\s*1[\s\S]{0,200}2\s*<=\s*1/],
 ['md table header', /\|[^\n]*row[^\n]*\|[^\n]*col[^\n]*\|[^\n]*cond[^\n]*\|[^\n]*output/i], ['example 4444', /4\s*4\s*4\s*4/],
];
const HIDDEN_IN_V2 = ['if (j<=i)', 'printf("*")', 'else'];
const [, , file, variant] = process.argv; const t = readFileSync(file, 'utf8');
const res = C.map(([n, re]) => [n, re.test(t)]);
const visible = variant === 'v2' ? res.filter(([n]) => !HIDDEN_IN_V2.includes(n)) : res;
const hidden = variant === 'v2' ? res.filter(([n]) => HIDDEN_IN_V2.includes(n)) : [];
const out = { file, variant, recall: `${visible.filter((r) => r[1]).length}/${visible.length}`, missed: visible.filter((r) => !r[1]).map((r) => r[0]),
  hidden_reported_as_text: hidden.filter((r) => r[1]).map((r) => r[0]), flags_occlusion: /obscur|hidden|cover|occlud|unreadable|illegible|\[\?|blocked/i.test(t) };
console.log(JSON.stringify(out));

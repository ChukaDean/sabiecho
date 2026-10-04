import { pipeline } from '@huggingface/transformers';
import { buildIndex, classify, DEFAULT_OPTIONS, type ClassifierOptions, type Embed } from '../src/lib/classifier';
import { EMBEDDING_MODEL } from '../src/lib/models';
import type { MeaningId } from '../src/lib/taxonomy';

type Case = { text: string; expected: MeaningId[] };

const CASES: Case[] = [
  {
    text: 'We had a great time. The host explained everything clearly, the food was excellent, but the farm was hard to find.',
    expected: [1, 4, 14, 25],
  },
  { text: 'Absolutely loved it, a wonderful day!', expected: [1] },
  { text: 'It was okay. Some parts were interesting, others were boring.', expected: [2] },
  { text: 'Honestly a bit of a mixed experience for us.', expected: [2] },
  { text: 'Very disappointing visit, I would not do it again.', expected: [3] },
  { text: 'The guide was so welcoming and the scenery was breathtaking.', expected: [6, 12] },
  { text: 'Too expensive for what you get and we waited an hour.', expected: [21, 23] },
  { text: 'We loved making the pottery ourselves. We will come back!', expected: [10, 26] },
  { text: 'Nous avons passé une excellente journée, merci beaucoup !', expected: [1] },
  { text: "C'était bien mais un peu trop cher.", expected: [2, 23] },
  { text: 'La visite était moyenne, avec du bon et du moins bon.', expected: [2] },
  { text: "Nous n'avons pas aimé, l'accueil était froid.", expected: [3, 7] },
  { text: "Le repas était délicieux et l'endroit magnifique. Je recommande !", expected: [12, 14, 26] },
  { text: "On s'est perdus en chemin, aucun panneau.", expected: [25] },
  { text: 'Il faisait trop chaud et il n’y avait pas d’ombre.', expected: [19] },
  { text: 'My phone battery died.', expected: [27] },
  { text: 'asdf', expected: [27] },
];

/** Worded differently from the taxonomy examples, to avoid overfitting. */
const HELD_OUT: Case[] = [
  { text: 'What a fantastic afternoon, thank you so much!', expected: [1] },
  { text: 'Kind of a so-so trip if I am honest.', expected: [2] },
  { text: 'I regret coming here, it was awful.', expected: [3] },
  { text: 'Our host told us so many stories about the history of the village.', expected: [4] },
  { text: 'The lady greeted us with a big smile and made us feel like family.', expected: [6] },
  { text: 'Her English was hard to follow.', expected: [9] },
  { text: 'The kids loved grinding the cassava themselves.', expected: [10] },
  { text: 'The views over the lake were gorgeous.', expected: [12] },
  { text: 'We tasted the palm wine and it was lovely.', expected: [14] },
  { text: 'I wish there had been a little shop for souvenirs.', expected: [17] },
  { text: 'The tour lasted way too long and the kids got bored.', expected: [21] },
  { text: 'For the price it was a bargain.', expected: [22] },
  { text: 'Our taxi driver could not find the place.', expected: [25] },
  { text: "Je dirai à tous mes amis de venir, c'était top.", expected: [1, 26] },
  { text: "Le guide nous a raconté l'histoire du village en détail.", expected: [4] },
  { text: 'Nous aurions voulu mettre la main à la pâte.', expected: [11] },
  { text: "Les toilettes n'étaient pas propres.", expected: [19] },
  { text: 'On a attendu le guide pendant une heure.', expected: [21] },
  { text: 'Beaucoup trop cher pour une si petite visite.', expected: [23] },
  { text: 'Le chemin était bien indiqué, facile à trouver.', expected: [24] },
];

const extractor = await pipeline('feature-extraction', EMBEDDING_MODEL.id, { dtype: EMBEDDING_MODEL.dtype });
const cache = new Map<string, number[]>();
const embed: Embed = async (texts) => {
  const missing = texts.filter((t) => !cache.has(t));
  if (missing.length) {
    const out = (await extractor(missing, { pooling: 'mean', normalize: true })).tolist() as number[][];
    missing.forEach((t, i) => cache.set(t, out[i]));
  }
  return texts.map((t) => cache.get(t)!);
};

const index = await buildIndex(embed);

async function run(name: string, cases: Case[], options: ClassifierOptions, verbose: boolean) {
  let exact = 0;
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const c of cases) {
    const r = await classify(index, embed, c.text, options);
    const got = new Set(r.selected);
    const want = new Set(c.expected);
    const ok = got.size === want.size && [...got].every((x) => want.has(x));
    if (ok) exact++;
    for (const g of got) (want.has(g) ? tp++ : fp++);
    for (const w of want) if (!got.has(w)) fn++;
    if (verbose) {
      const top = r.scores.slice(0, 5).map((s) => `${s.id}:${s.score.toFixed(2)}`).join(' ');
      console.log(`${ok ? 'OK  ' : 'MISS'} want=[${c.expected}] got=[${r.selected}]  ${c.text}\n      top ${top}`);
    }
  }
  const p = tp / (tp + fp);
  const rc = tp / (tp + fn);
  console.log(
    `${name.padEnd(10)} topic=${options.topicThreshold} overall=${options.overallThreshold}  exact ${exact}/${cases.length}  precision ${p.toFixed(2)}  recall ${rc.toFixed(2)}`,
  );
}

const verbose = process.argv.includes('--verbose');
if (process.argv.includes('--sweep')) {
  for (const topicThreshold of [0.5, 0.55, 0.6, 0.65]) {
    for (const overallThreshold of [0.5, 0.55, 0.6, 0.65, 0.7]) {
      await run('dev', CASES, { topicThreshold, overallThreshold }, false);
      await run('held-out', HELD_OUT, { topicThreshold, overallThreshold }, false);
    }
  }
} else {
  await run('dev', CASES, DEFAULT_OPTIONS, verbose);
  await run('held-out', HELD_OUT, DEFAULT_OPTIONS, verbose);
}

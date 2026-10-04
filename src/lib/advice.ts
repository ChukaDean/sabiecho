import type { Lang } from '../i18n';
import type { MeaningId } from './taxonomy';

export interface Advice {
  title: string;
  tips: string[];
}

/**
 * Written advice for each problem a visitor can raise, plus 3 (unhappy without a stated reason)
 * and 26 (happy visitors who could spread the word). Hosts and tourism partners should review these.
 */
export const ADVICE: Partial<Record<MeaningId, Record<Lang, Advice>>> = {
  3: {
    en: {
      title: 'Find out why some visitors were unhappy',
      tips: [
        'At the end of each visit, ask: “What could we do better?”',
        'Ask a language reviewer to read these reviews. SabiEcho may have missed the reason.',
      ],
    },
    fr: {
      title: 'Comprendre pourquoi certains visiteurs n’étaient pas contents',
      tips: [
        'À la fin de chaque visite, demandez : « Qu’est-ce qu’on pourrait faire mieux ? »',
        'Demandez à un relecteur de lire ces avis. SabiEcho n’a peut-être pas compris la raison.',
      ],
    },
  },
  5: {
    en: {
      title: 'Explain more during the visit',
      tips: [
        'Prepare 3 or 4 short stories about the history of the place and how things are made.',
        'Pause from time to time and ask visitors if they have questions.',
      ],
    },
    fr: {
      title: 'Expliquer davantage pendant la visite',
      tips: [
        'Préparez 3 ou 4 courtes histoires sur l’histoire du lieu et la façon dont les choses sont faites.',
        'Faites des pauses et demandez aux visiteurs s’ils ont des questions.',
      ],
    },
  },
  7: {
    en: {
      title: 'Make the welcome warmer',
      tips: [
        'Greet visitors as soon as they arrive, with a smile and their name if you know it.',
        'Offer water and a place to sit at the start.',
      ],
    },
    fr: {
      title: 'Rendre l’accueil plus chaleureux',
      tips: [
        'Accueillez les visiteurs dès leur arrivée, avec un sourire et leur prénom si vous le connaissez.',
        'Proposez de l’eau et un endroit où s’asseoir dès le début.',
      ],
    },
  },
  9: {
    en: {
      title: 'Make yourself easier to understand',
      tips: [
        'Speak slowly, use short sentences and show things with your hands.',
        'Ask a guide or volunteer to help translate the key moments, or prepare a small card with pictures.',
      ],
    },
    fr: {
      title: 'Se faire mieux comprendre',
      tips: [
        'Parlez lentement, avec des phrases courtes, et montrez les choses avec les mains.',
        'Demandez à un guide ou à un bénévole d’aider à traduire les moments clés, ou préparez une petite fiche avec des images.',
      ],
    },
  },
  11: {
    en: {
      title: 'Let visitors take part',
      tips: [
        'Choose one or two steps visitors can do themselves, like grinding, planting or cooking.',
        'Have spare aprons, gloves or tools ready so everyone can try.',
      ],
    },
    fr: {
      title: 'Faire participer les visiteurs',
      tips: [
        'Choisissez une ou deux étapes que les visiteurs peuvent faire eux-mêmes : moudre, planter, cuisiner…',
        'Prévoyez des tabliers, des gants ou des outils en plus pour que chacun puisse essayer.',
      ],
    },
  },
  13: {
    en: {
      title: 'Make the place more pleasant',
      tips: [
        'Clean and tidy the areas visitors see before each visit.',
        'Add shade, a place to sit or a simple decoration that shows what is special here.',
      ],
    },
    fr: {
      title: 'Rendre le lieu plus agréable',
      tips: [
        'Nettoyez et rangez les endroits que voient les visiteurs avant chaque visite.',
        'Ajoutez de l’ombre, un endroit où s’asseoir ou une décoration simple qui montre ce que le lieu a de spécial.',
      ],
    },
  },
  15: {
    en: {
      title: 'Offer more to eat or drink',
      tips: [
        'Always have drinking water ready for every visitor.',
        'Add a small tasting of a local snack or drink, and check the portions are enough for the group.',
      ],
    },
    fr: {
      title: 'Proposer plus à manger ou à boire',
      tips: [
        'Ayez toujours de l’eau potable pour chaque visiteur.',
        'Ajoutez une petite dégustation d’un en-cas ou d’une boisson locale, et vérifiez que les portions suffisent pour le groupe.',
      ],
    },
  },
  17: {
    en: {
      title: 'Have something for visitors to buy',
      tips: [
        'Set up a small table with local products or crafts at the end of the visit.',
        'Show clear prices and, if you can, accept mobile money.',
      ],
    },
    fr: {
      title: 'Proposer quelque chose à acheter',
      tips: [
        'Installez une petite table avec des produits locaux ou de l’artisanat à la fin de la visite.',
        'Affichez des prix clairs et, si possible, acceptez le paiement mobile.',
      ],
    },
  },
  19: {
    en: {
      title: 'Fix comfort and safety problems first',
      tips: [
        'Walk the visit route yourself and fix anything dangerous: paths, steps, animals, sharp tools.',
        'Make sure there is shade, drinking water and a clean toilet visitors can use.',
      ],
    },
    fr: {
      title: 'Régler d’abord les problèmes de confort et de sécurité',
      tips: [
        'Faites vous-même le parcours de la visite et corrigez ce qui est dangereux : chemins, marches, animaux, outils coupants.',
        'Assurez-vous qu’il y a de l’ombre, de l’eau potable et des toilettes propres pour les visiteurs.',
      ],
    },
  },
  21: {
    en: {
      title: 'Keep to time',
      tips: [
        'Tell visitors at the start how long the visit lasts, and keep to it.',
        'Be ready before visitors arrive so nobody waits, and warn them early if you will be late.',
      ],
    },
    fr: {
      title: 'Respecter les horaires',
      tips: [
        'Dites aux visiteurs au début combien de temps dure la visite, et respectez-le.',
        'Soyez prêt avant leur arrivée pour que personne n’attende, et prévenez tôt si vous avez du retard.',
      ],
    },
  },
  23: {
    en: {
      title: 'Show visitors what the price includes',
      tips: [
        'Explain before the visit what is included: a tasting, an activity, something to take home.',
        'Compare with similar visits nearby. Adding something small often works better than lowering the price.',
      ],
    },
    fr: {
      title: 'Montrer ce que comprend le prix',
      tips: [
        'Expliquez avant la visite ce qui est inclus : une dégustation, une activité, quelque chose à emporter.',
        'Comparez avec des visites semblables aux alentours. Ajouter un petit plus marche souvent mieux que baisser le prix.',
      ],
    },
  },
  25: {
    en: {
      title: 'Make the place easier to find',
      tips: [
        'Put up signs at the main road and at the last turns.',
        'Before visitors come, send them a map pin, a photo of the entrance and your phone number.',
      ],
    },
    fr: {
      title: 'Rendre le lieu plus facile à trouver',
      tips: [
        'Installez des panneaux sur la route principale et aux derniers virages.',
        'Avant leur venue, envoyez aux visiteurs un point sur la carte, une photo de l’entrée et votre numéro de téléphone.',
      ],
    },
  },
  26: {
    en: {
      title: 'Ask happy visitors to spread the word',
      tips: [
        'At the end of the visit, ask happy visitors to leave an online review or tell their friends.',
        'Give them a small card with your name, phone number and where to leave a review.',
      ],
    },
    fr: {
      title: 'Demander aux visiteurs contents d’en parler',
      tips: [
        'À la fin de la visite, demandez aux visiteurs contents de laisser un avis en ligne ou d’en parler à leurs amis.',
        'Donnez-leur une petite carte avec votre nom, votre numéro et où laisser un avis.',
      ],
    },
  },
};

export function getAdvice(id: MeaningId, lang: Lang): Advice | undefined {
  return ADVICE[id]?.[lang];
}

# RLC Hub Addon Manager : les addons en bref (FR)

Le guide complet pour créer un addon est en anglais : `ADDONS.md` (tu peux le donner tel quel à Claude, il marche
aussi si tu lui parles en français).

## Installer un addon (joueurs)

1. Dézippe le dossier de l'addon dans `Documents\RLC Hub Addon Manager\addons` (le dossier doit contenir `addon.json`).
2. Relance RLC Hub Addon Manager.
3. Crée une **nouvelle carrière** : au-dessus du bouton Start, active les addons que tu veux. Ceux qui ne marchent pas
   dans ce type de carrière (manager ou joueur) sont grisés.
4. Tu les vois dans l'onglet Setup, et tu peux les changer là après deux avertissements (ça peut casser la save).
   Si les addons viennent de personnes différentes, un avertissement te prévient qu'ils pourraient ne pas marcher ensemble.

Une save importée du jeu normal n'a aucun addon. Pour désactiver un addon pour tout le monde, renomme son dossier
avec un `_` devant (`_mon-addon`).

## Créer un addon (en 4 points)

1. Copie `examples\hello-world` dans `addons\` et change son `"id"` dans `addon.json`.
2. `main.js` : la logique. Tu **enveloppes** les fonctions du jeu (`hub.engine.advance`...) : tu gardes l'originale,
   tu l'appelles, tu ajoutes ta partie. Tes données vont dans `hub.data(state)`.
3. `ui.js` : les écrans. Tu remplaces les fonctions d'affichage du jeu (`doctorHtml`...) en appelant l'originale.
   Textes en anglais via `tl()`, traductions dans `"lang"` de `addon.json` (c'est toi qui traduis).
4. RLC Hub Addon Manager fait le reste : ton code ne tourne que dans les saves qui ont ton addon.
5. Ton addon ne marche qu'en carrière manager (ou joueur) ? Mets `"careers": ["manager"]` (ou `["player"]`) dans
   `addon.json` : il sera grisé dans l'autre type de carrière et n'y tournera pas.

Un souci ? Regarde `addons\_hubplus.log`.

Ne modifie jamais les fichiers du jeu, et ne partage pas son code : il appartient à ses auteurs. Ton addon est à
toi : choisis sa licence. Si tu portes le mod de quelqu'un d'autre, demande-lui son accord et crédite-le.

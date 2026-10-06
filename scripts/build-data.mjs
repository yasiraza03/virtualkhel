// Authoring tool for the bundled VIRTUALKHEL dataset.
// Run: node scripts/build-data.mjs  -> writes data/games.json, data/relationships.json, data/vocabulary.json
//
// Every row is hand-curated. Core facts (year, developer, publisher, platform families) come from public
// release records. Tags are EDITORIAL: a controlled vocabulary applied by hand, never generated from
// marketing copy and never converted into invented numeric "scores".
// A tag that is not obviously true for a title is left off — missing data is preferred to fabricated data.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

// ---------------------------------------------------------------- vocabulary
const VOCAB = {
  mechanic: [
    "open-world", "exploration", "crafting", "base-building", "building", "stealth", "roguelike", "metroidvania",
    "souls-like", "hack-and-slash", "procedural-generation", "permadeath", "puzzle-solving", "physics", "traversal",
    "parkour", "sandbox", "management", "city-building", "farming", "automation", "deck-building", "boss-fights",
    "loot", "party-based", "time-manipulation", "deduction", "social-sim", "immersive-sim", "collectathon",
    "precision-platforming", "run-and-gun", "battle-royale", "hero-shooter", "looter-shooter", "cover-shooter",
    "survival", "4x", "grand-strategy", "real-time-strategy", "driving", "sim-racing", "rally", "arcade", "flight",
    "colony-sim", "life-sim", "creature-collecting", "fighting", "platform-fighter", "hunting", "climbing",
    "time-loop", "destruction", "police-chase", "mech", "customization", "survival-horror", "psychological-horror",
    "point-and-click", "action-rpg", "kart", "sports", "hero-units", "theme-park", "trading", "illusion", "logic",
    "vr",
  ],
  combat: ["melee-combat", "ranged-combat", "turn-based", "tactical", "real-time-combat", "defenseless", "bullet-hell"],
  setting: [
    "sci-fi", "fantasy", "dark-fantasy", "post-apocalyptic", "historical", "medieval", "cyberpunk", "gothic",
    "modern", "western", "mythology", "supernatural", "space", "military", "superhero", "steampunk", "dystopian",
    "anime", "zombies", "wilderness", "underwater", "crime", "ninja", "alt-history", "demons", "paranormal",
    "pirates", "spy",
  ],
  narrative: [
    "story-rich", "choices-matter", "dialogue-heavy", "episodic", "mystery", "branching", "walking-simulator",
    "moral-choices", "multiple-endings", "wordless", "political", "detective", "anthology", "thriller",
  ],
  perspective: ["first-person", "third-person", "top-down", "isometric", "2d", "2.5d", "side-scrolling"],
  mode: ["co-op", "multiplayer", "competitive", "team-based", "party"],
  aesthetic: [
    "atmospheric", "pixel-art", "hand-drawn", "minimalist", "cozy", "stylish", "retro", "classic", "comedy",
    "realistic", "cinematic", "surreal",
  ],
};

const tagCategory = {};
for (const [cat, tags] of Object.entries(VOCAB)) for (const t of tags) {
  if (tagCategory[t]) throw new Error(`duplicate tag ${t}`);
  tagCategory[t] = cat;
}

const CLUSTERS = [
  "open-world", "narrative", "rpg", "stealth", "horror", "survival", "action", "strategy", "racing",
  "simulation", "platformer", "shooter", "puzzle",
];
const PLATFORM = { PC: "pc", PS: "playstation", XB: "xbox", NS: "nintendo", MO: "mobile" };

// --------------------------------------------------------------------- rows
// Title | year | developer(s) ; separated | publisher or - | cluster,secondary... | platforms | tags | franchise or -
const ROWS = `
The Legend of Zelda: Breath of the Wild|2017|Nintendo EPD|Nintendo|open-world,action|NS|open-world,exploration,fantasy,crafting,physics,climbing,third-person|The Legend of Zelda
The Legend of Zelda: Tears of the Kingdom|2023|Nintendo EPD|Nintendo|open-world,action|NS|open-world,exploration,fantasy,crafting,building,physics,climbing,third-person|The Legend of Zelda
Red Dead Redemption 2|2018|Rockstar Games|Rockstar Games|open-world,action|PC,PS,XB|open-world,western,historical,story-rich,hunting,third-person,realistic|Red Dead
Grand Theft Auto V|2013|Rockstar North|Rockstar Games|open-world,action|PC,PS,XB|open-world,crime,driving,multiplayer,story-rich,third-person,modern|Grand Theft Auto
The Witcher 3: Wild Hunt|2015|CD Projekt Red|CD Projekt|open-world,rpg|PC,PS,XB,NS|open-world,fantasy,story-rich,choices-matter,melee-combat,third-person|The Witcher
The Elder Scrolls V: Skyrim|2011|Bethesda Game Studios|Bethesda Softworks|open-world,rpg|PC,PS,XB,NS|open-world,fantasy,exploration,crafting,choices-matter,first-person,melee-combat|The Elder Scrolls
Fallout 4|2015|Bethesda Game Studios|Bethesda Softworks|open-world,rpg|PC,PS,XB|open-world,post-apocalyptic,crafting,base-building,ranged-combat,first-person,sci-fi|Fallout
Fallout: New Vegas|2010|Obsidian Entertainment|Bethesda Softworks|rpg,open-world|PC,PS,XB|open-world,post-apocalyptic,choices-matter,story-rich,ranged-combat,first-person,dialogue-heavy|Fallout
Cyberpunk 2077|2020|CD Projekt Red|CD Projekt|open-world,rpg|PC,PS,XB|open-world,cyberpunk,sci-fi,story-rich,choices-matter,first-person,ranged-combat|Cyberpunk
Elden Ring|2022|FromSoftware|Bandai Namco Entertainment|open-world,rpg,action|PC,PS,XB|open-world,souls-like,fantasy,dark-fantasy,exploration,melee-combat,third-person,boss-fights|-
Horizon Zero Dawn|2017|Guerrilla Games|Sony Interactive Entertainment|open-world,action,rpg|PC,PS|open-world,post-apocalyptic,sci-fi,ranged-combat,crafting,story-rich,third-person,exploration|Horizon
Assassin's Creed Odyssey|2018|Ubisoft Quebec|Ubisoft|open-world,rpg,stealth|PC,PS,XB|open-world,historical,melee-combat,choices-matter,exploration,third-person|Assassin's Creed
Assassin's Creed II|2009|Ubisoft Montreal|Ubisoft|action,stealth,open-world|PC,PS,XB|stealth,historical,open-world,parkour,melee-combat,third-person,story-rich|Assassin's Creed
Ghost of Tsushima|2020|Sucker Punch Productions|Sony Interactive Entertainment|open-world,action,stealth|PC,PS|open-world,historical,melee-combat,stealth,exploration,third-person,cinematic|Ghost
Marvel's Spider-Man|2018|Insomniac Games|Sony Interactive Entertainment|open-world,action|PC,PS|open-world,superhero,traversal,melee-combat,third-person,story-rich,modern|Marvel's Spider-Man
Far Cry 3|2012|Ubisoft Montreal|Ubisoft|open-world,shooter|PC,PS,XB|open-world,first-person,ranged-combat,stealth,crafting,hunting,story-rich|Far Cry
No Man's Sky|2016|Hello Games|Hello Games|open-world,survival|PC,PS,XB,NS|open-world,space,sci-fi,exploration,crafting,procedural-generation,multiplayer,first-person|-
Death Stranding|2019|Kojima Productions|Sony Interactive Entertainment|open-world,narrative|PC,PS|open-world,post-apocalyptic,sci-fi,traversal,story-rich,third-person,exploration|Death Stranding
Genshin Impact|2020|miHoYo|miHoYo|open-world,rpg|PC,PS,MO|open-world,fantasy,exploration,party-based,anime,third-person,real-time-combat,co-op|Genshin Impact
Outer Wilds|2019|Mobius Digital|Annapurna Interactive|narrative,open-world,puzzle|PC,PS,XB|exploration,space,sci-fi,time-loop,puzzle-solving,first-person,mystery,story-rich|-
Disco Elysium|2019|ZA/UM|ZA/UM|narrative,rpg|PC,PS,XB,NS|story-rich,choices-matter,dialogue-heavy,detective,political,isometric,mystery,multiple-endings|-
Life Is Strange|2015|Dontnod Entertainment|Square Enix|narrative|PC,PS,XB,MO|choices-matter,story-rich,time-manipulation,episodic,mystery,third-person,branching|Life Is Strange
The Last of Us|2013|Naughty Dog|Sony Interactive Entertainment|narrative,survival,stealth|PS,PC|post-apocalyptic,story-rich,stealth,crafting,ranged-combat,third-person,cinematic,zombies|The Last of Us
The Last of Us Part II|2020|Naughty Dog|Sony Interactive Entertainment|narrative,survival,stealth|PS,PC|post-apocalyptic,story-rich,stealth,crafting,ranged-combat,third-person,cinematic,zombies|The Last of Us
God of War|2018|Santa Monica Studio|Sony Interactive Entertainment|action,narrative|PS,PC|melee-combat,mythology,story-rich,exploration,boss-fights,third-person,cinematic|God of War
Firewatch|2016|Campo Santo|Panic|narrative|PC,PS,XB,NS|walking-simulator,story-rich,mystery,exploration,dialogue-heavy,first-person,wilderness|-
What Remains of Edith Finch|2017|Giant Sparrow|Annapurna Interactive|narrative|PC,PS,XB,NS,MO|walking-simulator,story-rich,anthology,first-person,atmospheric,exploration|-
Gone Home|2013|The Fullbright Company|The Fullbright Company|narrative|PC,PS,XB,NS|walking-simulator,story-rich,mystery,exploration,first-person|-
The Walking Dead (Telltale)|2012|Telltale Games|Telltale Games|narrative|PC,PS,XB,NS,MO|choices-matter,episodic,story-rich,post-apocalyptic,point-and-click,zombies,moral-choices,branching|The Walking Dead
Detroit: Become Human|2018|Quantic Dream|Sony Interactive Entertainment|narrative|PS,PC|choices-matter,story-rich,sci-fi,branching,multiple-endings,third-person,cinematic,dystopian|-
Return of the Obra Dinn|2018|Lucas Pope|3909 LLC|narrative,puzzle|PC,PS,XB,NS|mystery,deduction,puzzle-solving,story-rich,first-person,historical,detective|-
Kentucky Route Zero|2013|Cardboard Computer|Annapurna Interactive|narrative|PC,PS,XB,NS|point-and-click,story-rich,atmospheric,surreal,dialogue-heavy,2d|-
Oxenfree|2016|Night School Studio|Night School Studio|narrative|PC,PS,XB,NS,MO|supernatural,choices-matter,dialogue-heavy,mystery,story-rich,2d,branching|-
Journey|2012|thatgamecompany|Sony Interactive Entertainment|narrative|PS,PC|wordless,atmospheric,exploration,minimalist,co-op,third-person|-
Uncharted 4: A Thief's End|2016|Naughty Dog|Sony Interactive Entertainment|action,narrative|PS,PC|story-rich,cinematic,ranged-combat,climbing,third-person,exploration,modern|Uncharted
Mass Effect 2|2010|BioWare|Electronic Arts|rpg|PC,PS,XB|sci-fi,space,party-based,story-rich,choices-matter,ranged-combat,third-person,dialogue-heavy|Mass Effect
Baldur's Gate 3|2023|Larian Studios|Larian Studios|rpg|PC,PS,XB|fantasy,turn-based,party-based,choices-matter,story-rich,co-op,dialogue-heavy,branching|Baldur's Gate
Divinity: Original Sin 2|2017|Larian Studios|Larian Studios|rpg|PC,PS,XB,NS|fantasy,turn-based,party-based,co-op,choices-matter,story-rich,isometric|Divinity
Planescape: Torment|1999|Black Isle Studios|Interplay Entertainment|rpg|PC|fantasy,dialogue-heavy,story-rich,choices-matter,isometric,party-based,classic|-
Persona 5 Royal|2019|Atlus|Atlus|rpg|PS,PC,XB,NS|turn-based,party-based,anime,story-rich,social-sim,supernatural,modern,stylish|Persona
Final Fantasy VII|1997|Square|Square|rpg|PS,PC,XB,NS,MO|turn-based,party-based,fantasy,sci-fi,story-rich,classic|Final Fantasy
Chrono Trigger|1995|Square|Square|rpg|NS,PS,PC,MO|turn-based,party-based,fantasy,sci-fi,story-rich,time-manipulation,multiple-endings,classic,2d|Chrono
Pokémon Red and Blue|1996|Game Freak|Nintendo|rpg|NS|turn-based,creature-collecting,fantasy,exploration,2d,classic,multiplayer|Pokémon
Dragon Quest XI|2017|Square Enix|Square Enix|rpg|PC,PS,XB,NS|turn-based,party-based,fantasy,story-rich,exploration,third-person|Dragon Quest
Undertale|2015|Toby Fox|Toby Fox|rpg|PC,PS,XB,NS|turn-based,bullet-hell,story-rich,choices-matter,pixel-art,2d,comedy,multiple-endings|-
Darkest Dungeon|2016|Red Hook Studios|Red Hook Studios|rpg,strategy|PC,PS,XB,NS,MO|turn-based,roguelike,party-based,permadeath,dark-fantasy,gothic,2d|Darkest Dungeon
Dragon Age: Origins|2009|BioWare|Electronic Arts|rpg|PC,PS,XB|fantasy,party-based,story-rich,choices-matter,tactical,third-person,dialogue-heavy|Dragon Age
Diablo II|2000|Blizzard North|Blizzard Entertainment|rpg,action|PC|action-rpg,loot,dark-fantasy,isometric,co-op,multiplayer,classic|Diablo
Path of Exile|2013|Grinding Gear Games|Grinding Gear Games|rpg,action|PC,PS,XB|action-rpg,loot,dark-fantasy,isometric,multiplayer,real-time-combat|-
Xenoblade Chronicles 3|2022|Monolith Soft|Nintendo|rpg,open-world|NS|open-world,fantasy,sci-fi,party-based,story-rich,real-time-combat,exploration,third-person|Xenoblade Chronicles
Star Wars: Knights of the Old Republic|2003|BioWare|LucasArts|rpg|PC,XB,NS,MO|sci-fi,space,party-based,story-rich,choices-matter,moral-choices,third-person,dialogue-heavy|Star Wars
Fire Emblem: Three Houses|2019|Intelligent Systems;Koei Tecmo|Nintendo|strategy,rpg|NS|turn-based,tactical,party-based,fantasy,story-rich,social-sim,permadeath,third-person|Fire Emblem
XCOM 2|2016|Firaxis Games|2K Games|strategy|PC,PS,XB,NS|turn-based,tactical,sci-fi,permadeath,base-building,third-person,alt-history|XCOM
Sid Meier's Civilization VI|2016|Firaxis Games|2K Games|strategy|PC,PS,XB,NS,MO|4x,turn-based,historical,city-building,management,top-down|Civilization
StarCraft II: Wings of Liberty|2010|Blizzard Entertainment|Blizzard Entertainment|strategy|PC|real-time-strategy,sci-fi,space,competitive,multiplayer,base-building,top-down|StarCraft
Age of Empires II|1999|Ensemble Studios|Microsoft|strategy|PC,XB|real-time-strategy,historical,medieval,city-building,multiplayer,top-down,classic|Age of Empires
Total War: Three Kingdoms|2019|Creative Assembly|Sega|strategy|PC|grand-strategy,real-time-strategy,turn-based,historical,tactical,top-down|Total War
Into the Breach|2018|Subset Games|Subset Games|strategy,puzzle|PC,NS,MO|turn-based,tactical,sci-fi,puzzle-solving,mech,roguelike,top-down|-
Slay the Spire|2019|Mega Crit|Mega Crit|strategy|PC,PS,XB,NS,MO|deck-building,roguelike,turn-based,fantasy,permadeath,2d|-
Frostpunk|2018|11 bit studios|11 bit studios|strategy,survival,simulation|PC,PS,XB|city-building,survival,management,moral-choices,steampunk,post-apocalyptic,top-down,story-rich|Frostpunk
Crusader Kings III|2020|Paradox Development Studio|Paradox Interactive|strategy|PC,PS,XB|grand-strategy,historical,medieval,sandbox,top-down,story-rich|Crusader Kings
Stellaris|2016|Paradox Development Studio|Paradox Interactive|strategy|PC,PS,XB|grand-strategy,4x,sci-fi,space,top-down,sandbox|-
Anno 1800|2019|Ubisoft Blue Byte|Ubisoft|strategy,simulation|PC|city-building,management,historical,trading,top-down,sandbox|Anno
Command & Conquer: Red Alert 2|2000|Westwood Pacific|Electronic Arts|strategy|PC|real-time-strategy,alt-history,base-building,top-down,multiplayer,classic,military,comedy|Command & Conquer
Warcraft III: Reign of Chaos|2002|Blizzard Entertainment|Blizzard Entertainment|strategy|PC|real-time-strategy,fantasy,hero-units,base-building,story-rich,multiplayer,top-down|Warcraft
Heroes of Might and Magic III|1999|New World Computing|The 3DO Company|strategy|PC|turn-based,fantasy,4x,hero-units,classic,top-down|Heroes of Might and Magic
Cities: Skylines|2015|Colossal Order|Paradox Interactive|simulation,strategy|PC,PS,XB,NS|city-building,management,sandbox,top-down|Cities: Skylines
RimWorld|2018|Ludeon Studios|Ludeon Studios|simulation,strategy,survival|PC,PS,XB|colony-sim,base-building,survival,management,sci-fi,procedural-generation,top-down,sandbox|-
Factorio|2020|Wube Software|Wube Software|simulation,strategy|PC,NS|automation,base-building,management,sandbox,multiplayer,co-op,top-down|-
Stardew Valley|2016|ConcernedApe|ConcernedApe|simulation,rpg|PC,PS,XB,NS,MO|farming,cozy,crafting,social-sim,pixel-art,co-op,2d,top-down|-
Animal Crossing: New Horizons|2020|Nintendo EPD|Nintendo|simulation|NS|life-sim,cozy,social-sim,crafting,customization,multiplayer,sandbox|Animal Crossing
The Sims 4|2014|Maxis|Electronic Arts|simulation|PC,PS,XB|life-sim,sandbox,building,social-sim,customization,modern,third-person|The Sims
Euro Truck Simulator 2|2012|SCS Software|SCS Software|simulation|PC|driving,management,open-world,realistic,sandbox,trading|-
Microsoft Flight Simulator|2020|Asobo Studio|Xbox Game Studios|simulation|PC,XB|flight,realistic,sandbox,open-world,modern|Microsoft Flight Simulator
Kerbal Space Program|2015|Squad|Private Division|simulation,puzzle|PC,PS,XB|space,physics,sandbox,puzzle-solving,sci-fi,building,management|Kerbal Space Program
Planet Coaster|2016|Frontier Developments|Frontier Developments|simulation|PC|theme-park,management,building,sandbox,customization|-
Two Point Hospital|2018|Two Point Studios|Sega|simulation|PC,PS,XB,NS|management,comedy,building,top-down|Two Point
Forza Horizon 5|2021|Playground Games|Xbox Game Studios|racing,open-world|PC,XB,PS|driving,open-world,arcade,multiplayer,customization,exploration,modern|Forza Horizon
Gran Turismo 7|2022|Polyphony Digital|Sony Interactive Entertainment|racing|PS|driving,sim-racing,realistic,customization,multiplayer|Gran Turismo
Mario Kart 8 Deluxe|2017|Nintendo EPD|Nintendo|racing|NS|kart,arcade,multiplayer,party,competitive,stylish|Mario Kart
Need for Speed: Most Wanted|2005|EA Canada|Electronic Arts|racing|PC,PS,XB,NS|driving,open-world,arcade,police-chase,customization,crime|Need for Speed
Burnout Paradise|2008|Criterion Games|Electronic Arts|racing,open-world|PC,PS,XB,NS|driving,open-world,arcade,destruction,multiplayer|Burnout
Assetto Corsa|2014|Kunos Simulazioni|Kunos Simulazioni|racing|PC,PS,XB|driving,sim-racing,realistic,customization,multiplayer|Assetto Corsa
Rocket League|2015|Psyonix|Psyonix|racing|PC,PS,XB,NS|driving,sports,competitive,multiplayer,physics,arcade,team-based|-
DiRT Rally 2.0|2019|Codemasters|Codemasters|racing|PC,PS,XB|driving,rally,realistic,sim-racing,multiplayer|DiRT
Metal Gear Solid|1998|Konami Computer Entertainment Japan|Konami|stealth,action|PS,PC|stealth,military,story-rich,cinematic,third-person,boss-fights,classic|Metal Gear
Metal Gear Solid V: The Phantom Pain|2015|Kojima Productions|Konami|stealth,open-world|PC,PS,XB|stealth,open-world,military,base-building,third-person,ranged-combat,story-rich|Metal Gear
Dishonored|2012|Arkane Studios|Bethesda Softworks|stealth,action|PC,PS,XB|stealth,immersive-sim,supernatural,steampunk,choices-matter,first-person,melee-combat,moral-choices|Dishonored
Thief: The Dark Project|1998|Looking Glass Studios|Eidos Interactive|stealth|PC|stealth,immersive-sim,medieval,steampunk,first-person,classic|Thief
Hitman (2016)|2016|IO Interactive|Square Enix|stealth|PC,PS,XB|stealth,sandbox,puzzle-solving,crime,third-person,modern|Hitman
Deus Ex|2000|Ion Storm|Eidos Interactive|stealth,rpg,shooter|PC,PS|immersive-sim,cyberpunk,sci-fi,choices-matter,stealth,first-person,dystopian,story-rich|Deus Ex
Tom Clancy's Splinter Cell: Chaos Theory|2005|Ubisoft Montreal|Ubisoft|stealth,action|PC,PS,XB|stealth,military,modern,third-person,thriller|Splinter Cell
A Plague Tale: Innocence|2019|Asobo Studio|Focus Home Interactive|stealth,narrative|PC,PS,XB|stealth,historical,medieval,puzzle-solving,story-rich,third-person,cinematic|A Plague Tale
Mark of the Ninja|2012|Klei Entertainment|Microsoft Studios|stealth,platformer|PC,PS,XB,NS|stealth,ninja,2d,puzzle-solving,side-scrolling,stylish|-
Resident Evil 2 (2019)|2019|Capcom|Capcom|horror,action|PC,PS,XB|survival-horror,zombies,puzzle-solving,third-person,modern,ranged-combat|Resident Evil
Resident Evil 4 (2023)|2023|Capcom|Capcom|horror,action|PC,PS,XB|survival-horror,zombies,third-person,ranged-combat,boss-fights,modern|Resident Evil
Silent Hill 2|2001|Team Silent|Konami|horror|PS,XB,PC|psychological-horror,atmospheric,story-rich,third-person,puzzle-solving,supernatural,multiple-endings|Silent Hill
Alien: Isolation|2014|Creative Assembly|Sega|horror,stealth|PC,PS,XB,NS,MO|survival-horror,stealth,sci-fi,space,first-person,atmospheric,defenseless|Alien
Amnesia: The Dark Descent|2010|Frictional Games|Frictional Games|horror|PC,PS,XB|psychological-horror,first-person,atmospheric,puzzle-solving,defenseless,gothic|Amnesia
Outlast|2013|Red Barrels|Red Barrels|horror|PC,PS,XB,NS|survival-horror,first-person,defenseless,stealth,modern|Outlast
Dead Space|2008|Visceral Games|Electronic Arts|horror,shooter|PC,PS,XB|survival-horror,sci-fi,space,third-person,ranged-combat,atmospheric|Dead Space
Five Nights at Freddy's|2014|Scott Cawthon|Scott Cawthon|horror|PC,MO,PS,XB,NS|survival-horror,defenseless,point-and-click,modern,management|Five Nights at Freddy's
Phasmophobia|2020|Kinetic Games|Kinetic Games|horror|PC,PS,XB|paranormal,co-op,multiplayer,first-person,defenseless,modern|-
Little Nightmares|2017|Tarsier Studios|Bandai Namco Entertainment|horror,puzzle,platformer|PC,PS,XB,NS|puzzle-solving,stealth,atmospheric,2.5d,defenseless,surreal|Little Nightmares
Alan Wake 2|2023|Remedy Entertainment|Epic Games Publishing|horror,narrative|PC,PS,XB|survival-horror,psychological-horror,story-rich,mystery,third-person,supernatural,thriller|Alan Wake
Minecraft|2011|Mojang Studios|Mojang Studios|survival,open-world|PC,PS,XB,NS,MO|sandbox,crafting,building,survival,procedural-generation,multiplayer,first-person,exploration|Minecraft
Terraria|2011|Re-Logic|Re-Logic|survival,platformer|PC,PS,XB,NS,MO|sandbox,crafting,exploration,boss-fights,co-op,multiplayer,2d,survival,building|-
Subnautica|2018|Unknown Worlds Entertainment|Unknown Worlds Entertainment|survival,open-world|PC,PS,XB,NS|survival,crafting,exploration,underwater,sci-fi,base-building,first-person,open-world|Subnautica
Don't Starve|2013|Klei Entertainment|Klei Entertainment|survival|PC,PS,XB,NS,MO|survival,crafting,permadeath,procedural-generation,gothic,2d,top-down,hand-drawn|Don't Starve
The Long Dark|2017|Hinterland Studio|Hinterland Studio|survival|PC,PS,XB,NS|survival,crafting,wilderness,first-person,atmospheric,exploration,realistic|-
Valheim|2021|Iron Gate Studio|Coffee Stain Publishing|survival,open-world|PC,XB|survival,crafting,base-building,mythology,co-op,procedural-generation,open-world,third-person,melee-combat|-
Rust|2018|Facepunch Studios|Facepunch Studios|survival|PC,PS,XB|survival,crafting,base-building,multiplayer,first-person,ranged-combat,open-world|-
Project Zomboid|2013|The Indie Stone|The Indie Stone|survival|PC|survival,zombies,crafting,permadeath,base-building,isometric,post-apocalyptic,co-op,sandbox|-
Green Hell|2019|Creepy Jar|Creepy Jar|survival|PC,PS,XB,NS|survival,wilderness,crafting,first-person,realistic,exploration|-
Dying Light|2015|Techland|Warner Bros. Interactive Entertainment|survival,action|PC,PS,XB|survival,parkour,zombies,open-world,first-person,melee-combat,co-op,crafting|Dying Light
Devil May Cry 5|2019|Capcom|Capcom|action|PC,PS,XB|hack-and-slash,stylish,demons,melee-combat,third-person,boss-fights,supernatural|Devil May Cry
Bayonetta|2009|PlatinumGames|Sega|action|PS,XB,PC,NS|hack-and-slash,stylish,melee-combat,third-person,supernatural,boss-fights|Bayonetta
Dark Souls|2011|FromSoftware|Namco Bandai Games|action,rpg|PC,PS,XB,NS|souls-like,dark-fantasy,fantasy,melee-combat,boss-fights,third-person,exploration,atmospheric|Dark Souls
Demon's Souls|2009|FromSoftware|Sony Computer Entertainment|action,rpg|PS|souls-like,dark-fantasy,fantasy,melee-combat,boss-fights,third-person,atmospheric|Demon's Souls
Bloodborne|2015|FromSoftware|Sony Computer Entertainment|action,horror,rpg|PS|souls-like,gothic,melee-combat,boss-fights,third-person,atmospheric,supernatural|-
Sekiro: Shadows Die Twice|2019|FromSoftware|Activision|action,stealth|PC,PS,XB|melee-combat,stealth,boss-fights,historical,third-person,ninja|-
Hades|2020|Supergiant Games|Supergiant Games|action,rpg|PC,PS,XB,NS,MO|roguelike,mythology,melee-combat,isometric,story-rich,procedural-generation,permadeath,action-rpg|Hades
Dead Cells|2018|Motion Twin|Motion Twin|action,platformer|PC,PS,XB,NS,MO|roguelike,metroidvania,melee-combat,pixel-art,2d,permadeath,side-scrolling,procedural-generation|-
Super Smash Bros. Ultimate|2018|Bandai Namco Studios;Sora Ltd.|Nintendo|action|NS|fighting,platform-fighter,multiplayer,party,competitive,2.5d|Super Smash Bros.
Street Fighter 6|2023|Capcom|Capcom|action|PC,PS,XB|fighting,competitive,multiplayer,stylish|Street Fighter
NieR: Automata|2017|PlatinumGames|Square Enix|action,rpg|PC,PS,XB,NS|hack-and-slash,sci-fi,post-apocalyptic,story-rich,multiple-endings,third-person,melee-combat,action-rpg|NieR
Monster Hunter: World|2018|Capcom|Capcom|action|PC,PS,XB|hunting,boss-fights,crafting,co-op,melee-combat,third-person,fantasy,multiplayer|Monster Hunter
Batman: Arkham City|2011|Rocksteady Studios|Warner Bros. Interactive Entertainment|action,stealth,open-world|PC,PS,XB|superhero,open-world,stealth,melee-combat,third-person,modern,story-rich|Batman: Arkham
Control|2019|Remedy Entertainment|505 Games|action|PC,PS,XB|supernatural,third-person,ranged-combat,exploration,story-rich,modern,mystery|-
Tomb Raider (2013)|2013|Crystal Dynamics|Square Enix|action,survival|PC,PS,XB|survival,exploration,puzzle-solving,ranged-combat,third-person,climbing,cinematic|Tomb Raider
Shadow of the Colossus|2005|Team Ico|Sony Computer Entertainment|action|PS|boss-fights,exploration,atmospheric,minimalist,fantasy,third-person,climbing|-
Half-Life 2|2004|Valve|Valve|shooter|PC,PS,XB|first-person,sci-fi,physics,story-rich,ranged-combat,dystopian|Half-Life
Counter-Strike: Global Offensive|2012|Valve;Hidden Path Entertainment|Valve|shooter|PC,PS,XB|first-person,competitive,multiplayer,team-based,tactical,ranged-combat,modern|Counter-Strike
Halo: Combat Evolved|2001|Bungie|Microsoft Game Studios|shooter|XB,PC|first-person,sci-fi,space,co-op,ranged-combat,story-rich|Halo
BioShock|2007|2K Boston;2K Australia|2K Games|shooter|PC,PS,XB,NS|first-person,dystopian,immersive-sim,story-rich,atmospheric,ranged-combat,alt-history|BioShock
Titanfall 2|2016|Respawn Entertainment|Electronic Arts|shooter|PC,PS,XB|first-person,mech,sci-fi,parkour,story-rich,ranged-combat,multiplayer|Titanfall
Overwatch|2016|Blizzard Entertainment|Blizzard Entertainment|shooter|PC,PS,XB,NS|hero-shooter,multiplayer,competitive,team-based,sci-fi,first-person,ranged-combat|Overwatch
Apex Legends|2019|Respawn Entertainment|Electronic Arts|shooter|PC,PS,XB,NS,MO|battle-royale,hero-shooter,multiplayer,first-person,team-based,sci-fi,ranged-combat|Titanfall
Fortnite|2017|Epic Games|Epic Games|shooter|PC,PS,XB,NS,MO|battle-royale,building,multiplayer,third-person,ranged-combat,team-based,comedy|-
Destiny 2|2017|Bungie|Activision|shooter,rpg|PC,PS,XB|looter-shooter,first-person,co-op,sci-fi,space,loot,ranged-combat,multiplayer|Destiny
Gears of War|2006|Epic Games|Microsoft Game Studios|shooter|XB,PC|cover-shooter,third-person,co-op,sci-fi,ranged-combat,military|Gears of War
Metro Exodus|2019|4A Games|Deep Silver|shooter,survival,stealth|PC,PS,XB|post-apocalyptic,first-person,survival,stealth,story-rich,ranged-combat,crafting|Metro
S.T.A.L.K.E.R.: Shadow of Chernobyl|2007|GSC Game World|THQ|shooter,survival,open-world|PC|post-apocalyptic,first-person,open-world,survival,atmospheric,ranged-combat,exploration,sci-fi|S.T.A.L.K.E.R.
Borderlands 2|2012|Gearbox Software|2K Games|shooter,rpg|PC,PS,XB,NS,MO|looter-shooter,loot,co-op,first-person,sci-fi,comedy,ranged-combat|Borderlands
DOOM (2016)|2016|id Software|Bethesda Softworks|shooter,action|PC,PS,XB,NS|first-person,ranged-combat,demons,sci-fi,boss-fights,stylish|Doom
Super Mario Bros.|1985|Nintendo R&D4|Nintendo|platformer|NS|side-scrolling,2d,classic,precision-platforming,retro|Super Mario
Super Mario Odyssey|2017|Nintendo EPD|Nintendo|platformer|NS|collectathon,exploration,third-person,precision-platforming,boss-fights,stylish|Super Mario
Celeste|2018|Maddy Makes Games|Maddy Makes Games|platformer|PC,PS,XB,NS|precision-platforming,2d,pixel-art,climbing,story-rich,side-scrolling|-
Hollow Knight|2017|Team Cherry|Team Cherry|platformer,action|PC,PS,XB,NS|metroidvania,2d,hand-drawn,exploration,melee-combat,boss-fights,atmospheric,side-scrolling|-
Super Metroid|1994|Nintendo R&D1;Intelligent Systems|Nintendo|platformer,action|NS|metroidvania,2d,sci-fi,exploration,atmospheric,classic,side-scrolling,boss-fights|Metroid
Metroid Dread|2021|MercurySteam;Nintendo EPD|Nintendo|platformer,action|NS|metroidvania,2d,sci-fi,exploration,boss-fights,atmospheric,side-scrolling|Metroid
Ori and the Blind Forest|2015|Moon Studios|Microsoft Studios|platformer|PC,XB,NS|metroidvania,2d,precision-platforming,atmospheric,hand-drawn,story-rich,side-scrolling,fantasy|Ori
Sonic Mania|2017|Christian Whitehead;Headcannon;PagodaWest Games|Sega|platformer|PC,PS,XB,NS|2d,pixel-art,retro,side-scrolling,classic,arcade|Sonic the Hedgehog
Rayman Legends|2013|Ubisoft Montpellier|Ubisoft|platformer|PC,PS,XB,NS|2d,co-op,hand-drawn,precision-platforming,side-scrolling,comedy|Rayman
Cuphead|2017|Studio MDHR|Studio MDHR|platformer,action|PC,XB,PS,NS|run-and-gun,boss-fights,hand-drawn,co-op,2d,side-scrolling,retro|-
Shovel Knight|2014|Yacht Club Games|Yacht Club Games|platformer|PC,PS,XB,NS|2d,pixel-art,retro,melee-combat,side-scrolling,precision-platforming,fantasy|Shovel Knight
Portal|2007|Valve|Valve|puzzle|PC,PS,XB,NS|puzzle-solving,physics,first-person,sci-fi,comedy|Portal
Portal 2|2011|Valve|Valve|puzzle|PC,PS,XB,NS|puzzle-solving,physics,first-person,sci-fi,co-op,comedy,story-rich|Portal
The Witness|2016|Thekla, Inc.|Thekla, Inc.|puzzle|PC,PS,XB,NS,MO|puzzle-solving,exploration,first-person,open-world,minimalist,logic|-
Baba Is You|2019|Hempuli|Hempuli|puzzle|PC,NS|puzzle-solving,logic,2d,pixel-art,minimalist|-
Monument Valley|2014|ustwo games|ustwo games|puzzle|MO|puzzle-solving,illusion,minimalist,atmospheric,isometric|Monument Valley
Myst|1993|Cyan|Brøderbund|puzzle,narrative|PC,PS,MO,NS|puzzle-solving,exploration,first-person,atmospheric,mystery,point-and-click,classic|Myst
Braid|2008|Number None|Number None|puzzle,platformer|PC,XB,PS|puzzle-solving,time-manipulation,2d,side-scrolling,story-rich,hand-drawn|-
Papers, Please|2013|Lucas Pope|3909 LLC|puzzle,simulation|PC,MO,PS|dystopian,moral-choices,management,2d,story-rich,political,pixel-art,multiple-endings|-
God of War Ragnarök|2022|Santa Monica Studio|Sony Interactive Entertainment|action,narrative|PS,PC|melee-combat,mythology,story-rich,exploration,boss-fights,third-person,cinematic|God of War
Ghost of Yotei|2025|Sucker Punch Productions|Sony Interactive Entertainment|open-world,action,stealth|PS|open-world,historical,melee-combat,stealth,exploration,third-person,cinematic|Ghost
Marvel's Spider-Man 2|2023|Insomniac Games|Sony Interactive Entertainment|open-world,action|PS,PC|open-world,superhero,traversal,melee-combat,third-person,story-rich,modern|Marvel's Spider-Man
Horizon Forbidden West|2022|Guerrilla Games|Sony Interactive Entertainment|open-world,action,rpg|PS,PC|open-world,post-apocalyptic,sci-fi,ranged-combat,crafting,story-rich,third-person,exploration|Horizon
Uncharted: The Lost Legacy|2017|Naughty Dog|Sony Interactive Entertainment|action,narrative|PS,PC|story-rich,cinematic,ranged-combat,climbing,third-person,exploration,puzzle-solving|Uncharted
Uncharted 2: Among Thieves|2009|Naughty Dog|Sony Computer Entertainment|action,narrative|PS|story-rich,cinematic,ranged-combat,climbing,third-person,exploration|Uncharted
Uncharted 3: Drake's Deception|2011|Naughty Dog|Sony Computer Entertainment|action,narrative|PS|story-rich,cinematic,ranged-combat,climbing,third-person,exploration|Uncharted
Uncharted: Drake's Fortune|2007|Naughty Dog|Sony Computer Entertainment|action,narrative|PS|story-rich,cinematic,ranged-combat,climbing,third-person,exploration|Uncharted
Resident Evil Requiem|2026|Capcom|Capcom|horror,action|PC,PS,XB,NS|survival-horror,psychological-horror,atmospheric,story-rich,first-person,third-person,puzzle-solving|Resident Evil
Red Dead Redemption|2010|Rockstar San Diego|Rockstar Games|open-world,action|PS,XB,NS,PC|open-world,western,historical,story-rich,hunting,third-person,ranged-combat|Red Dead
Batman: Arkham Knight|2015|Rocksteady Studios|Warner Bros. Interactive Entertainment|open-world,action,stealth|PC,PS,XB|superhero,open-world,stealth,melee-combat,third-person,modern,story-rich,driving|Batman: Arkham
Days Gone|2019|Bend Studio|Sony Interactive Entertainment|open-world,survival,action|PS,PC|open-world,survival,zombies,post-apocalyptic,crafting,third-person,ranged-combat,story-rich|-
Death Stranding 2: On the Beach|2025|Kojima Productions|Sony Interactive Entertainment|open-world,narrative|PS|open-world,post-apocalyptic,sci-fi,traversal,story-rich,third-person,exploration,cinematic|Death Stranding
Ratchet & Clank: Rift Apart|2021|Insomniac Games|Sony Interactive Entertainment|action,platformer|PS,PC|third-person,sci-fi,ranged-combat,boss-fights,stylish,comedy,collectathon|Ratchet & Clank
Final Fantasy VII Remake|2020|Square Enix|Square Enix|rpg,action|PS,PC|real-time-combat,party-based,fantasy,sci-fi,story-rich,third-person,cinematic|Final Fantasy
Final Fantasy VII Rebirth|2024|Square Enix|Square Enix|rpg,action,open-world|PS,PC|real-time-combat,party-based,fantasy,sci-fi,story-rich,third-person,open-world,exploration|Final Fantasy
Final Fantasy XVI|2023|Square Enix|Square Enix|rpg,action|PS,PC|real-time-combat,dark-fantasy,fantasy,story-rich,third-person,boss-fights,cinematic|Final Fantasy
Dragon's Dogma 2|2024|Capcom|Capcom|rpg,open-world,action|PC,PS,XB|open-world,action-rpg,fantasy,party-based,exploration,melee-combat,third-person|Dragon's Dogma
Horizon Call of the Mountain|2023|Guerrilla Games;Firesprite|Sony Interactive Entertainment|action|PS|vr,climbing,post-apocalyptic,sci-fi,first-person,ranged-combat,exploration|Horizon
Alan Wake|2010|Remedy Entertainment|Microsoft Game Studios|horror,narrative,action|PC,PS,XB|psychological-horror,story-rich,atmospheric,third-person,supernatural,thriller,mystery|Alan Wake
Forza Horizon 6|2026|Playground Games|Xbox Game Studios|racing,open-world|PC,XB,PS|driving,open-world,arcade,multiplayer,customization,exploration,modern|Forza Horizon
Mina the Hollower|2026|Yacht Club Games|Yacht Club Games|action,platformer|PC,PS,XB,NS|pixel-art,melee-combat,top-down,exploration,boss-fights,gothic,2d|-
007 First Light|2026*|IO Interactive|IO Interactive|action,stealth|PC,PS,XB,NS|stealth,spy,modern,story-rich,third-person,cinematic|-
Saros|2026*|Housemarque|Sony Interactive Entertainment|action|PS|roguelike,sci-fi,third-person,ranged-combat,boss-fights,permadeath|-
The Blood of Dawnwalker|2026*|Rebel Wolves|Bandai Namco Entertainment|rpg,open-world|PC,PS,XB|open-world,dark-fantasy,story-rich,choices-matter,melee-combat,third-person,gothic,supernatural|-
Pragmata|2026*|Capcom|Capcom|action,shooter|PC,PS,XB|sci-fi,space,third-person,ranged-combat,story-rich,puzzle-solving|-
Nioh 3|2026*|Team Ninja|Koei Tecmo|action,rpg|PC,PS|souls-like,action-rpg,historical,melee-combat,boss-fights,third-person,supernatural,ninja|Nioh
Monster Hunter Stories 3|2026*|Capcom|Capcom|rpg|PC,PS,NS|turn-based,creature-collecting,fantasy,party-based,story-rich,exploration,third-person|Monster Hunter
Mewgenics|2026*|Edmund McMillen;Tyler Glaiel|-|strategy,rpg|PC|turn-based,tactical,roguelike,permadeath,comedy,hand-drawn,creature-collecting|-
Pokémon Pokopia|2026*|?|Nintendo|simulation|NS|life-sim,cozy,building,crafting,creature-collecting,sandbox,customization|Pokémon
Big Walk|2026*|House House|-|narrative,simulation|PC|co-op,multiplayer,exploration,comedy,wilderness,third-person,puzzle-solving|-
Cairn|2026*|The Game Bakers|The Game Bakers|survival,simulation|PC,PS|climbing,survival,wilderness,realistic,third-person,physics|-
Trails in the Sky 2nd Chapter|2026*|Nihon Falcom|NIS America|rpg|PC,PS,NS|turn-based,party-based,fantasy,story-rich,dialogue-heavy,exploration,anime|Trails
Onimusha: Way of the Sword|2026*|Capcom|Capcom|action|PC,PS,XB|melee-combat,historical,demons,supernatural,third-person,boss-fights,ninja|Onimusha
Phantom Blade Zero|2026*|S-GAME|S-GAME|action|PC,PS|melee-combat,dark-fantasy,boss-fights,third-person,stylish,historical|-
Silent Hill: Townfall|2026*|No Code|Konami|horror,narrative|PC,PS,XB|psychological-horror,atmospheric,story-rich,supernatural,mystery|Silent Hill
A Plague Tale: Requiem|2022|Asobo Studio|Focus Entertainment|stealth,narrative|PC,PS,XB,NS|stealth,historical,medieval,puzzle-solving,story-rich,third-person,cinematic|A Plague Tale
Until Dawn|2015|Supermassive Games|Sony Computer Entertainment|horror,narrative|PS,PC|survival-horror,choices-matter,branching,multiple-endings,story-rich,third-person,cinematic,supernatural|-
Heavy Rain|2010|Quantic Dream|Sony Computer Entertainment|narrative|PS,PC|choices-matter,story-rich,branching,multiple-endings,detective,mystery,third-person,cinematic|-
Beyond: Two Souls|2013|Quantic Dream|Sony Computer Entertainment|narrative|PS,PC|choices-matter,story-rich,branching,supernatural,third-person,cinematic|-
The Quarry|2022|Supermassive Games|2K Games|horror,narrative|PC,PS,XB|survival-horror,choices-matter,branching,multiple-endings,story-rich,third-person,cinematic,supernatural|-
Life is Strange: True Colors|2021|Deck Nine|Square Enix|narrative|PC,PS,XB,NS|choices-matter,story-rich,supernatural,mystery,third-person,branching,dialogue-heavy|Life Is Strange
Hellblade: Senua's Sacrifice|2017|Ninja Theory|Ninja Theory|action,narrative|PC,PS,XB,NS|psychological-horror,story-rich,atmospheric,melee-combat,third-person,mythology,cinematic|Hellblade
Senua's Saga: Hellblade II|2024|Ninja Theory|Xbox Game Studios|action,narrative|PC,XB,PS|psychological-horror,story-rich,atmospheric,melee-combat,third-person,mythology,cinematic,realistic|Hellblade
Marvel's Guardians of the Galaxy|2021|Eidos-Montréal|Square Enix|action,narrative|PC,PS,XB,NS|superhero,story-rich,choices-matter,space,sci-fi,third-person,ranged-combat,comedy|-
Star Wars Jedi: Fallen Order|2019|Respawn Entertainment|Electronic Arts|action,rpg|PC,PS,XB|souls-like,sci-fi,space,melee-combat,metroidvania,third-person,story-rich,exploration|Star Wars
Star Wars Jedi: Survivor|2023|Respawn Entertainment|Electronic Arts|action,rpg|PC,PS,XB|souls-like,sci-fi,space,melee-combat,metroidvania,third-person,story-rich,exploration|Star Wars
Assassin's Creed IV: Black Flag|2013|Ubisoft Montreal|Ubisoft|open-world,action,stealth|PC,PS,XB|open-world,historical,pirates,stealth,melee-combat,third-person,exploration,story-rich|Assassin's Creed
Assassin's Creed Origins|2017|Ubisoft Montreal|Ubisoft|open-world,rpg,stealth|PC,PS,XB|open-world,historical,action-rpg,melee-combat,stealth,exploration,third-person|Assassin's Creed
Assassin's Creed Shadows|2025|Ubisoft Quebec|Ubisoft|open-world,rpg,stealth|PC,PS,XB|open-world,historical,action-rpg,stealth,melee-combat,ninja,third-person,exploration|Assassin's Creed
Rise of the Ronin|2024|Team Ninja|Sony Interactive Entertainment|open-world,action,rpg|PS,PC|open-world,historical,melee-combat,action-rpg,stealth,third-person,choices-matter|-
Lies of P|2023|Round8 Studio|Neowiz|action,rpg|PC,PS,XB|souls-like,dark-fantasy,gothic,melee-combat,boss-fights,third-person,atmospheric,steampunk|Lies of P
Black Myth: Wukong|2024|Game Science|Game Science|action,rpg|PC,PS,XB|action-rpg,mythology,melee-combat,boss-fights,third-person,fantasy,stylish|Black Myth
Armored Core VI: Fires of Rubicon|2023|FromSoftware|Bandai Namco Entertainment|action|PC,PS,XB|mech,sci-fi,boss-fights,customization,third-person,ranged-combat|Armored Core
Monster Hunter Wilds|2025|Capcom|Capcom|action,open-world|PC,PS,XB|hunting,boss-fights,crafting,co-op,melee-combat,third-person,fantasy,multiplayer,open-world|Monster Hunter
Dragon Age: The Veilguard|2024|BioWare|Electronic Arts|rpg,action|PC,PS,XB|action-rpg,fantasy,party-based,story-rich,choices-matter,third-person,dialogue-heavy|Dragon Age
Kingdom Come: Deliverance II|2025|Warhorse Studios|Deep Silver|rpg,open-world|PC,PS,XB|open-world,historical,medieval,realistic,melee-combat,first-person,story-rich,choices-matter|Kingdom Come
Mafia: Definitive Edition|2020|Hangar 13|2K Games|open-world,action,narrative|PC,PS,XB|open-world,crime,historical,driving,story-rich,third-person,cinematic,ranged-combat|Mafia
Mafia II|2010|2K Czech|2K Games|open-world,action,narrative|PC,PS,XB|open-world,crime,historical,driving,story-rich,third-person,ranged-combat|Mafia
Mafia III|2016|Hangar 13|2K Games|open-world,action|PC,PS,XB|open-world,crime,historical,driving,stealth,third-person,ranged-combat|Mafia
Rise of the Tomb Raider|2015|Crystal Dynamics|Square Enix|action,survival|PC,PS,XB|survival,exploration,puzzle-solving,ranged-combat,third-person,climbing,stealth,cinematic|Tomb Raider
Shadow of the Tomb Raider|2018|Eidos-Montréal|Square Enix|action,survival|PC,PS,XB|survival,exploration,puzzle-solving,ranged-combat,third-person,climbing,stealth,cinematic|Tomb Raider
Dying Light 2 Stay Human|2022|Techland|Techland|survival,action,open-world|PC,PS,XB,NS|survival,parkour,zombies,open-world,first-person,melee-combat,co-op,crafting,choices-matter|Dying Light
The Elder Scrolls IV: Oblivion|2006|Bethesda Game Studios|2K Games|rpg,open-world|PC,XB,PS|open-world,fantasy,exploration,choices-matter,first-person,melee-combat,sandbox|The Elder Scrolls
DOOM: The Dark Ages|2025|id Software|Bethesda Softworks|shooter,action|PC,PS,XB|first-person,ranged-combat,demons,dark-fantasy,medieval,boss-fights,melee-combat|Doom
Gears of War: E-Day|2026|The Coalition|Xbox Game Studios|shooter|PC,XB|cover-shooter,third-person,co-op,sci-fi,ranged-combat,military,story-rich|Gears of War
Inside|2016|Playdead|Playdead|puzzle,platformer|PC,PS,XB,NS,MO|puzzle-solving,atmospheric,2.5d,dystopian,side-scrolling,stealth,wordless|-
`.trim().split("\n");


function slug(title) {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const games = [];
const seen = new Set();
for (const raw of ROWS) {
  const parts = raw.split("|");
  if (parts.length !== 8) throw new Error(`bad row (${parts.length} cols): ${raw}`);
  const [title, yearRaw, devs, pub, genres, plats, tagStr, franchise] = parts;
  // A trailing "*" on the year marks a title announced for that year but not confirmed released at curation time.
  const upcoming = yearRaw.endsWith("*");
  const year = upcoming ? yearRaw.slice(0, -1) : yearRaw;
  const tags = tagStr.split(",").map((t) => t.trim());
  for (const t of tags) if (!tagCategory[t]) throw new Error(`unknown tag "${t}" in ${title}`);
  const gen = genres.split(",");
  for (const g of gen) if (!CLUSTERS.includes(g)) throw new Error(`unknown genre ${g} in ${title}`);
  const platforms = plats.split(",").map((p) => {
    if (!PLATFORM[p]) throw new Error(`unknown platform ${p} in ${title}`);
    return PLATFORM[p];
  });
  const id = slug(title);
  if (seen.has(id)) throw new Error(`duplicate id ${id}`);
  seen.add(id);
  games.push({
    id,
    title,
    year: Number(year),
    status: upcoming ? "upcoming" : "released",
    // "?" means the developer was not verifiable at curation time; an empty list is honest, a guess is not.
    developers: devs === "?" ? [] : devs.split(";").map((d) => d.trim()),
    publisher: pub === "-" ? null : pub,
    genres: [...new Set(gen)],
    platforms: [...new Set(platforms)],
    tags: [...new Set(tags)].sort(),
    franchise: franchise === "-" ? null : franchise,
    officialUrl: null,
    image: null,
    provenance: {
      core: upcoming
        ? "Announced title: year, developers and publisher come from the announcement, not from a release record, and may change."
        : "Hand-curated from public release records (year, developers, publisher, platform families).",
      tags: "Editorial classification using the fixed vocabulary in vocabulary.json; not machine generated.",
    },
  });
}

// Curated relationships that are widely documented. Everything else is derived from shared metadata.
const RELS = [
  ["demons-souls", "dark-souls", "spiritual-successor", "Dark Souls is widely described as the spiritual successor to Demon's Souls (same studio, same design lineage)."],
  ["dark-souls", "elden-ring", "design-lineage", "Elden Ring continues FromSoftware's action-RPG design lineage from Demon's Souls and Dark Souls."],
  ["half-life-2", "portal-2", "shared-universe", "Portal is set in the same fictional universe as Half-Life (Aperture Science / Black Mesa)."],
  ["portal", "half-life-2", "shared-universe", "Portal is set in the same fictional universe as Half-Life (Aperture Science / Black Mesa)."],
  ["apex-legends", "titanfall-2", "shared-universe", "Apex Legends is set in the Titanfall universe."],
  ["alan-wake", "control", "shared-universe", "Alan Wake and Control are explicitly linked as part of Remedy's connected universe."],
  ["alan-wake", "alan-wake-2", "design-lineage", "Alan Wake 2 is the direct sequel, continuing the same story and studio's design."],
  ["bloodborne", "lies-of-p", "design-lineage", "Lies of P is widely described as following Bloodborne's aggressive souls-like design."],
  ["demons-souls", "nioh-3", "design-lineage", "Team Ninja's Nioh series follows the souls-like template FromSoftware established."],
  ["dark-souls", "star-wars-jedi-fallen-order", "design-lineage", "Fallen Order's combat and checkpoint design were openly modelled on Dark Souls."],
  ["metal-gear-solid-v-the-phantom-pain", "death-stranding", "design-lineage", "Death Stranding is Kojima Productions' first game after Metal Gear Solid V, by the same director."],
  ["uncharted-4-a-thiefs-end", "uncharted-the-lost-legacy", "design-lineage", "The Lost Legacy is a standalone expansion built on Uncharted 4."],
].filter(([a, b]) => seen.has(a) && seen.has(b));

const vocabulary = Object.entries(VOCAB).flatMap(([category, tags]) =>
  tags.map((tag) => ({ tag, category, label: tag.replace(/-/g, " ") })),
);

writeFileSync(join(root, "games.json"), JSON.stringify(games, null, 1) + "\n");
writeFileSync(
  join(root, "relationships.json"),
  JSON.stringify(RELS.map(([a, b, type, note]) => ({ a, b, type, note, source: "curated" })), null, 1) + "\n",
);
writeFileSync(join(root, "vocabulary.json"), JSON.stringify(vocabulary, null, 1) + "\n");
console.log(`wrote ${games.length} games, ${RELS.length} curated relationships, ${vocabulary.length} vocabulary tags`);

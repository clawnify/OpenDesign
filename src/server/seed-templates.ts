// Starter templates shipped with the app.
//
// These used to live as an INSERT in src/server/schema.sql. Clawnify applies
// schema.sql as DDL only — a single non-DDL statement fails the whole deploy —
// so the rows moved here and are inserted by ensureSeeded() in index.ts.
//
// Every row has an explicit id and is inserted with INSERT OR IGNORE, so a
// redeploy never resurrects a template the user deleted or overwrites an edit.

export interface SeedTemplate {
  id: string;
  name: string;
  category: string;
  canvas_json: string;
  width: number;
  height: number;
  sort_order: number;
}

export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    id: "quote-card",
    name: "Quote Card",
    category: "linkedin",
    canvas_json: "{\"version\":\"6.0.0\",\"objects\":[{\"type\":\"rect\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1080,\"fill\":\"#1a1a2e\"},{\"type\":\"textbox\",\"left\":80,\"top\":300,\"width\":920,\"text\":\"Your inspiring quote goes here\",\"fontSize\":48,\"fontFamily\":\"Playfair Display\",\"fontWeight\":\"700\",\"fill\":\"#ffffff\",\"textAlign\":\"center\"},{\"type\":\"textbox\",\"left\":80,\"top\":900,\"width\":920,\"text\":\"— Author Name\",\"fontSize\":24,\"fontFamily\":\"Inter\",\"fontWeight\":\"500\",\"fill\":\"#a0a0b0\",\"textAlign\":\"center\"}]}",
    width: 1080,
    height: 1080,
    sort_order: 1,
  },
  {
    id: "stats-highlight",
    name: "Stats Highlight",
    category: "linkedin",
    canvas_json: "{\"version\":\"6.0.0\",\"objects\":[{\"type\":\"rect\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1080,\"fill\":\"#0f172a\"},{\"type\":\"textbox\",\"left\":80,\"top\":200,\"width\":920,\"text\":\"87%\",\"fontSize\":120,\"fontFamily\":\"Montserrat\",\"fontWeight\":\"900\",\"fill\":\"#3b82f6\",\"textAlign\":\"center\"},{\"type\":\"textbox\",\"left\":80,\"top\":400,\"width\":920,\"text\":\"of professionals agree that AI\\nwill transform their industry\",\"fontSize\":36,\"fontFamily\":\"Inter\",\"fontWeight\":\"500\",\"fill\":\"#e2e8f0\",\"textAlign\":\"center\"},{\"type\":\"textbox\",\"left\":80,\"top\":900,\"width\":920,\"text\":\"Source: Industry Report 2026\",\"fontSize\":18,\"fontFamily\":\"Inter\",\"fontWeight\":\"400\",\"fill\":\"#64748b\",\"textAlign\":\"center\"}]}",
    width: 1080,
    height: 1080,
    sort_order: 2,
  },
  {
    id: "announcement",
    name: "Announcement",
    category: "linkedin",
    canvas_json: "{\"version\":\"6.0.0\",\"objects\":[{\"type\":\"rect\",\"left\":0,\"top\":0,\"width\":1200,\"height\":627,\"fill\":\"#ffffff\"},{\"type\":\"rect\",\"left\":0,\"top\":0,\"width\":8,\"height\":627,\"fill\":\"#2563eb\"},{\"type\":\"textbox\",\"left\":60,\"top\":80,\"width\":400,\"text\":\"NEW\",\"fontSize\":16,\"fontFamily\":\"Montserrat\",\"fontWeight\":\"800\",\"fill\":\"#2563eb\",\"letterSpacing\":4},{\"type\":\"textbox\",\"left\":60,\"top\":120,\"width\":1080,\"text\":\"We are excited to announce\\nsomething big\",\"fontSize\":48,\"fontFamily\":\"Montserrat\",\"fontWeight\":\"700\",\"fill\":\"#0f172a\"},{\"type\":\"textbox\",\"left\":60,\"top\":500,\"width\":1080,\"text\":\"Learn more at yourcompany.com\",\"fontSize\":20,\"fontFamily\":\"Inter\",\"fontWeight\":\"500\",\"fill\":\"#64748b\"}]}",
    width: 1200,
    height: 627,
    sort_order: 3,
  },
  {
    id: "tips-list",
    name: "Tips List",
    category: "linkedin",
    canvas_json: "{\"version\":\"6.0.0\",\"objects\":[{\"type\":\"rect\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1080,\"fill\":\"#fafaf9\"},{\"type\":\"textbox\",\"left\":80,\"top\":80,\"width\":920,\"text\":\"5 Tips for Better\\nProductivity\",\"fontSize\":44,\"fontFamily\":\"Montserrat\",\"fontWeight\":\"800\",\"fill\":\"#1c1917\"},{\"type\":\"textbox\",\"left\":80,\"top\":280,\"width\":920,\"text\":\"1. Start with the hardest task\\n\\n2. Time-block your calendar\\n\\n3. Limit notifications\\n\\n4. Take regular breaks\\n\\n5. Review and reflect daily\",\"fontSize\":28,\"fontFamily\":\"Inter\",\"fontWeight\":\"400\",\"fill\":\"#44403c\",\"lineHeight\":1.6}]}",
    width: 1080,
    height: 1080,
    sort_order: 4,
  },
  {
    id: "profile-card",
    name: "Profile Card",
    category: "linkedin",
    canvas_json: "{\"version\":\"6.0.0\",\"objects\":[{\"type\":\"rect\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1080,\"fill\":\"#18181b\"},{\"type\":\"circle\",\"left\":440,\"top\":180,\"radius\":100,\"fill\":\"#3f3f46\"},{\"type\":\"textbox\",\"left\":80,\"top\":420,\"width\":920,\"text\":\"Jane Smith\",\"fontSize\":40,\"fontFamily\":\"Montserrat\",\"fontWeight\":\"700\",\"fill\":\"#fafafa\",\"textAlign\":\"center\"},{\"type\":\"textbox\",\"left\":80,\"top\":490,\"width\":920,\"text\":\"Product Designer @ TechCo\",\"fontSize\":22,\"fontFamily\":\"Inter\",\"fontWeight\":\"400\",\"fill\":\"#a1a1aa\",\"textAlign\":\"center\"},{\"type\":\"textbox\",\"left\":140,\"top\":600,\"width\":800,\"text\":\"Passionate about creating intuitive user experiences that make complex tools feel simple.\",\"fontSize\":20,\"fontFamily\":\"Inter\",\"fontWeight\":\"400\",\"fill\":\"#d4d4d8\",\"textAlign\":\"center\"}]}",
    width: 1080,
    height: 1080,
    sort_order: 5,
  },
  {
    id: "minimal-text",
    name: "Minimal Text",
    category: "linkedin",
    canvas_json: "{\"version\":\"6.0.0\",\"objects\":[{\"type\":\"rect\",\"left\":0,\"top\":0,\"width\":1080,\"height\":1080,\"fill\":\"#f8fafc\"},{\"type\":\"textbox\",\"left\":120,\"top\":380,\"width\":840,\"text\":\"Less is more.\",\"fontSize\":64,\"fontFamily\":\"Playfair Display\",\"fontWeight\":\"600\",\"fill\":\"#0f172a\",\"textAlign\":\"center\"},{\"type\":\"textbox\",\"left\":120,\"top\":520,\"width\":840,\"text\":\"Sometimes the simplest message\\nhas the biggest impact.\",\"fontSize\":22,\"fontFamily\":\"Inter\",\"fontWeight\":\"400\",\"fill\":\"#64748b\",\"textAlign\":\"center\"}]}",
    width: 1080,
    height: 1080,
    sort_order: 6,
  },
];

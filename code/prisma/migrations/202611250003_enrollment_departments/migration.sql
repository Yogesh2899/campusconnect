INSERT INTO "Department" ("id", "name") VALUES
  ('thapar-basic-engineering', 'Basic & Engineering Sciences (Dera Bassi Campus)'),
  ('thapar-chemical', 'Department of Chemical Engineering'),
  ('thapar-civil', 'Department of Civil Engineering'),
  ('thapar-electrical', 'Department of Electrical & Instrumentation Engineering'),
  ('thapar-electronics', 'Department of Electronics & Communication Engineering'),
  ('thapar-mechanical', 'Department of Mechanical Engineering'),
  ('thapar-biotechnology', 'Department of Biotechnology'),
  ('thapar-chemistry', 'Department of Chemistry & Biochemistry (DST-FIST Sponsored)'),
  ('thapar-computer-science', 'Department of Computer Science & Engineering'),
  ('thapar-energy', 'Department of Energy and Environment (DST-FIST Sponsored)'),
  ('thapar-humanities', 'Department of Humanities & Social Sciences'),
  ('thapar-mathematics', 'Department of Mathematics'),
  ('thapar-physics', 'Department of Physics & Materials Science')
ON CONFLICT ("name") DO NOTHING;

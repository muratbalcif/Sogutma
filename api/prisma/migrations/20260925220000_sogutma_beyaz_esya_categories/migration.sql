-- Soğutma and beyaz eşya category trees. Idempotent on slug.

INSERT INTO "categories" ("id", "parentId", "name", "slug", "sortOrder", "active", "updatedAt")
VALUES
  (gen_random_uuid(), NULL, 'Soğutma', 'sogutma', 2, true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), NULL, 'Beyaz Eşya', 'beyaz-esya', 3, true, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "parentId" = EXCLUDED."parentId",
  "sortOrder" = EXCLUDED."sortOrder",
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "categories" ("id", "parentId", "name", "slug", "sortOrder", "active", "updatedAt")
SELECT gen_random_uuid(), parent."id", child."name", child."slug", child."sortOrder", true, CURRENT_TIMESTAMP
FROM (
  VALUES
    ('sogutma', 'Buzdolabı', 'buzdolabi', 1),
    ('sogutma', 'Derin Dondurucu', 'derin-dondurucu', 2),
    ('sogutma', 'Teşhir Dolabı', 'teshir-dolabi', 3),
    ('sogutma', 'Şişe Soğutucu', 'sise-sogutucu', 4),
    ('sogutma', 'Su Sebili', 'su-sebili', 5),
    ('sogutma', 'Buz Makinesi', 'buz-makinesi', 6),
    ('sogutma', 'Soğuk Oda', 'soguk-oda', 7),
    ('beyaz-esya', 'Çamaşır Makinesi', 'camasir-makinesi', 1),
    ('beyaz-esya', 'Kurutma Makinesi', 'kurutma-makinesi', 2),
    ('beyaz-esya', 'Bulaşık Makinesi', 'bulasik-makinesi', 3),
    ('beyaz-esya', 'Fırın', 'firin', 4),
    ('beyaz-esya', 'Ocak', 'ocak', 5),
    ('beyaz-esya', 'Davlumbaz', 'davlumbaz', 6),
    ('beyaz-esya', 'Ankastre', 'ankastre', 7)
) AS child("parentSlug", "name", "slug", "sortOrder")
JOIN "categories" AS parent ON parent."slug" = child."parentSlug"
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "parentId" = EXCLUDED."parentId",
  "sortOrder" = EXCLUDED."sortOrder",
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "categories"
SET "sortOrder" = 4, "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'yedek-parca' AND "parentId" IS NULL;

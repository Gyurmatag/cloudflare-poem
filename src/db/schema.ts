import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const poems = sqliteTable("poems", {
    id: integer("id", { mode: "number" }).primaryKey(),
    text: text("text").notNull(),
    imgBucketName: text("img_bucket_name").notNull(),
    createdDate: text("created_date").notNull().default(sql`(current_timestamp)`),
});
import * as PrismaPkg from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neon } from "@neondatabase/serverless";

const { PrismaClient } = (PrismaPkg as any);

const connectionString = process.env.DATABASE_URL!;
const sql = neon(connectionString);
const adapter = new PrismaNeon({ connectionString });

export const prisma = new PrismaClient({ adapter });

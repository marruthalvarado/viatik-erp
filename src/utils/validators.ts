import { z } from "zod";

export const emailSchema = z.string().email("Email inválido");
export const requiredString = (msg = "Requerido") => z.string().min(1, msg);
export const optionalString = z.string().optional().nullable();
export const positiveNumber = z.number().nonnegative("Debe ser positivo");

export const idSchema = z.string().uuid("ID inválido");

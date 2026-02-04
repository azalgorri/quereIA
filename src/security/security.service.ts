import crypto from "crypto";
import { Injectable } from "@nestjs/common";

const SECRET_KEY = process.env.PSEUDONYM_KEY ?? "dev-key-change";

@Injectable()
export class SecurityService {
  pseudonymizeCards(cards: Array<Record<string, any>>) {
    const map = new Map<string, string>();
    let counter = 1;

    const replace = (value: string) => {
      return value.replace(/\b\d{4,}\b/g, (match) => {
        if (!map.has(match)) {
          map.set(match, `NUM_${counter++}`);
        }
        return map.get(match) ?? match;
      });
    };

    const payloadCards = cards.map((card) => ({
      ...card,
      hecho: replace(card.hecho),
      impacto: replace(card.impacto),
      peticion: card.peticion ? replace(card.peticion) : null,
      evidencias: card.evidencias.map((ev: any) => ({
        ...ev,
        citaLiteral: ev.citaLiteral ? replace(ev.citaLiteral) : null,
      })),
    }));

    return { payloadCards, pseudonymMap: Object.fromEntries(map.entries()) };
  }

  encryptMap(map: Record<string, string>) {
    const iv = crypto.randomBytes(12);
    const key = crypto.createHash("sha256").update(SECRET_KEY).digest();
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const payload = Buffer.concat([cipher.update(JSON.stringify(map), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, payload]).toString("base64");
  }
}

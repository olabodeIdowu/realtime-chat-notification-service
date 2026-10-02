import { Kafka } from "kafkajs";
import { config } from "./index";

export const kafka = new Kafka({
  clientId: config.kafkaClientId,
  brokers: config.kafkaBrokers,
});

export const producer = kafka.producer();

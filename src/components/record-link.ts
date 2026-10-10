import { ArrowUpRight } from "@lucide/svelte";
import { recordHref } from "@/shared/client-navigation";
import type { DomainRecord } from "@/shared/contracts";
import { navigateRecord } from "@/shared/client-navigation";
import styles from "./record-links.module.css";

export { default as RecordLink } from "./record-link.RecordLink.svelte";

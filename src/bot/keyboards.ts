import { InlineKeyboard } from "grammy";
import type {
  ArchiveYear,
  Course,
  Folder,
  Level,
  Term,
} from "../types/domain.js";

export const labels = {
  main: "القائمة الرئيسية",
  back: "رجوع",
};

export function withNavigation(
  keyboard: InlineKeyboard,
  back?: string,
): InlineKeyboard {
  if (back) keyboard.row().text(labels.back, back);
  keyboard.row().text(labels.main, "nav:home");
  return keyboard;
}

export function listKeyboard<T extends { id: number; title: string }>(
  items: T[],
  callback: (item: T) => string,
  back?: string,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const item of items) keyboard.text(item.title, callback(item)).row();
  return withNavigation(keyboard, back);
}

export function mainMenu(levels: Level[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const level of levels)
    keyboard.text(level.title, `nav:l:${level.id}`).row();
  keyboard.text("🗂 السنين السابقة", "nav:archives").row();
  keyboard
    .text("🔎 بحث", "nav:search")
    .text("🎓 فرقتي الحالية", "nav:my")
    .row();
  keyboard.text("ℹ️ نبذة عن AGR Study", "nav:about").row();
  keyboard.text("✉️ تواصل معنا", "nav:contact").row();
  return keyboard;
}

export function levelsKeyboard(
  levels: Level[],
  callbackPrefix: string,
  back?: string,
): InlineKeyboard {
  return listKeyboard(levels, (level) => `${callbackPrefix}:${level.id}`, back);
}

export function termsKeyboard(
  terms: Term[],
  callbackPrefix: string,
  back: string,
): InlineKeyboard {
  return listKeyboard(terms, (term) => `${callbackPrefix}:${term.id}`, back);
}

export function coursesKeyboard(
  courses: Course[],
  callbackPrefix: string,
  back: string,
): InlineKeyboard {
  return listKeyboard(
    courses,
    (course) => `${callbackPrefix}:${course.id}`,
    back,
  );
}

export function foldersKeyboard(
  folders: Folder[],
  callbackPrefix: string,
  back: string,
): InlineKeyboard {
  return listKeyboard(
    folders,
    (folder) => `${callbackPrefix}:${folder.id}`,
    back,
  );
}

export function archivesKeyboard(
  years: ArchiveYear[],
  callbackPrefix: string,
  back?: string,
): InlineKeyboard {
  return listKeyboard(years, (year) => `${callbackPrefix}:${year.id}`, back);
}

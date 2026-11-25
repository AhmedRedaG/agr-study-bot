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

export function displayTermTitle(title: string): string {
  return title.replaceAll("الفصل", "الترم").replaceAll("فصل", "ترم");
}

export type MainMenuCallback = "nav:home" | "adm:home";

export function withNavigation(
  keyboard: InlineKeyboard,
  back?: string,
  mainMenuCallback: MainMenuCallback = "nav:home",
): InlineKeyboard {
  if (back) keyboard.row().text(labels.back, back);
  keyboard.row().text(labels.main, mainMenuCallback);
  return keyboard;
}

export function listKeyboard<T extends { id: number; title: string }>(
  items: T[],
  callback: (item: T) => string,
  back?: string,
  mainMenuCallback: MainMenuCallback = "nav:home",
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const item of items) keyboard.text(item.title, callback(item)).row();
  return withNavigation(keyboard, back, mainMenuCallback);
}

export function mainMenu(
  levels: Level[],
  quickAccess?: { callback: string },
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const level of levels)
    keyboard.text(level.title, `nav:l:${level.id}`).row();
  if (quickAccess) {
    keyboard.text("⚡ متابعة دراستي", quickAccess.callback).row();
  }
  keyboard
    .text("🕰 السنين السابقة", "nav:archives")
    .row()
    .text("🔎 بحث", "nav:search")
    .text("🎓 فرقتي الحالية", "nav:my")
    .row()
    .text("ℹ️ نبذة عننا", "nav:about")
    .text("💬 تواصل معنا", "nav:contact")
    .row();
  return keyboard;
}

export function levelsKeyboard(
  levels: Level[],
  callbackPrefix: string,
  back?: string,
  mainMenuCallback: MainMenuCallback = "nav:home",
): InlineKeyboard {
  return listKeyboard(
    levels,
    (level) => `${callbackPrefix}:${level.id}`,
    back,
    mainMenuCallback,
  );
}

export function termsKeyboard(
  terms: Term[],
  callbackPrefix: string,
  back: string,
  mainMenuCallback: MainMenuCallback = "nav:home",
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const term of terms)
    keyboard
      .text(displayTermTitle(term.title), `${callbackPrefix}:${term.id}`)
      .row();
  return withNavigation(keyboard, back, mainMenuCallback);
}

export function coursesKeyboard(
  courses: Course[],
  callbackPrefix: string,
  back: string,
  mainMenuCallback: MainMenuCallback = "nav:home",
): InlineKeyboard {
  return listKeyboard(
    courses,
    (course) => `${callbackPrefix}:${course.id}`,
    back,
    mainMenuCallback,
  );
}

export function foldersKeyboard(
  folders: Folder[],
  callbackPrefix: string,
  back: string,
  mainMenuCallback: MainMenuCallback = "nav:home",
): InlineKeyboard {
  return listKeyboard(
    folders,
    (folder) => `${callbackPrefix}:${folder.id}`,
    back,
    mainMenuCallback,
  );
}

export function archivesKeyboard(
  years: ArchiveYear[],
  callbackPrefix: string,
  back?: string,
  mainMenuCallback: MainMenuCallback = "nav:home",
): InlineKeyboard {
  return listKeyboard(
    years,
    (year) => `${callbackPrefix}:${year.id}`,
    back,
    mainMenuCallback,
  );
}

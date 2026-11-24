import { Bot, InlineKeyboard, type Context } from "grammy";
import { env, isAdmin } from "../config/env.js";
import { ensureSchema } from "../db/schema.js";
import { StudyRepository } from "../repositories/study-repository.js";
import { UserRepository } from "../repositories/user-repository.js";
import { BroadcastService } from "../services/broadcast-service.js";
import { scheduleBackgroundTask } from "../services/background-tasks.js";
import { StudyService } from "../services/study-service.js";
import type { AdminState, Resource } from "../types/domain.js";
import {
  archivesKeyboard,
  coursesKeyboard,
  foldersKeyboard,
  labels,
  levelsKeyboard,
  mainMenu,
  termsKeyboard,
  withNavigation,
} from "./keyboards.js";

const bot = new Bot(env.botToken);
const content = new StudyRepository();
const study = new StudyService(content);
const users = new UserRepository();
const broadcast = new BroadcastService(content, users);

async function show(
  ctx: Context,
  text: string,
  keyboard: InlineKeyboard,
): Promise<void> {
  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, { reply_markup: keyboard });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes("message is not modified"))
        throw error;
    }
  } else {
    await ctx.reply(text, { reply_markup: keyboard });
  }
}

function section(title: string, detail?: string): string {
  return `🏛 AGR Study\n━━━━━━━━━━━━━━\n${title}${detail ? `\n\n${detail}` : ""}`;
}

function navigation(back?: string): InlineKeyboard {
  return withNavigation(new InlineKeyboard(), back);
}

async function sendHome(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (from) await users.clearState(from.id);
  const levels = await content.levels();
  const detail = levels.length
    ? "اختر الفرقة لبدء التصفح، أو استخدم البحث للوصول إلى مادة أو ملف بسرعة."
    : "المحتوى الأكاديمي قيد الإعداد. يمكنك استكشاف الأرشيف أو معلومات المنصة والتواصل مع الإدارة.";
  await show(ctx, section("منصة الموارد الأكاديمية", detail), mainMenu(levels));
}

async function ensureSubscribed(ctx: Context): Promise<boolean> {
  if (!env.requiredChannelId || !ctx.from || isAdmin(ctx.from.id)) return true;
  try {
    const member = await ctx.api.getChatMember(
      env.requiredChannelId,
      ctx.from.id,
    );
    if (
      member.status === "creator" ||
      member.status === "administrator" ||
      member.status === "member" ||
      (member.status === "restricted" && member.is_member)
    ) {
      return true;
    }
  } catch (error) {
    console.error("Could not verify required channel membership:", error);
    await ctx.reply("تعذر التحقق من الاشتراك الآن. حاول مرة أخرى بعد قليل.");
    return false;
  }
  const keyboard = new InlineKeyboard();
  if (env.requiredChannelUsername)
    keyboard
      .url(
        "📢 الانضمام للقناة",
        `https://t.me/${env.requiredChannelUsername.replace(/^@/, "")}`,
      )
      .row();
  keyboard
    .text("✅ تحققت من الاشتراك", "nav:check")
    .row()
    .text(labels.main, "nav:home");
  await show(
    ctx,
    section(
      "الاشتراك مطلوب",
      "يرجى الانضمام إلى قناة المنصة ثم الضغط على زر التحقق للمتابعة.",
    ),
    keyboard,
  );
  return false;
}

bot.use(async (ctx, next) => {
  await ensureSchema();
  if (ctx.from) {
    await users.upsert({
      id: ctx.from.id,
      first_name: ctx.from.first_name,
      ...(ctx.from.username ? { username: ctx.from.username } : {}),
    });
  }
  if (ctx.callbackQuery?.data === "nav:check") return next();
  if (!(await ensureSubscribed(ctx))) return;
  await next();
});

bot.command("start", async (ctx) => {
  await sendHome(ctx);
});

bot.command("admin", async (ctx) => {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    await ctx.reply("هذا القسم مخصص لفريق إدارة AGR Study.");
    return;
  }
  await users.clearState(ctx.from.id);
  await showAdmin(ctx);
});

bot.command("cancel", async (ctx) => {
  if (ctx.from) await users.clearState(ctx.from.id);
  await show(
    ctx,
    section("تم إلغاء العملية", "يمكنك العودة للقائمة واختيار إجراء آخر."),
    navigation("nav:home"),
  );
});

bot.callbackQuery("nav:check", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (await ensureSubscribed(ctx)) await sendHome(ctx);
});

bot.on("callback_query:data", async (ctx) => {
  await ctx.answerCallbackQuery();
  const data = ctx.callbackQuery.data;
  try {
    await routeCallback(ctx, data);
  } catch (error) {
    console.error(`Callback ${data} failed:`, error);
    await ctx.reply(
      "حدث خطأ أثناء تنفيذ الطلب. لم تُحذف بياناتك؛ يرجى المحاولة مجددًا أو التواصل مع الإدارة.",
    );
  }
});

async function routeCallback(ctx: Context, data: string): Promise<void> {
  const parts = data.split(":");
  const [area, action, rawId, rawOther] = parts;
  const id = Number(rawId);
  const other = Number(rawOther);

  if (data === "nav:home") return sendHome(ctx);
  if (data === "nav:archives") {
    const years = await content.archiveYears();
    return show(
      ctx,
      section(
        "السنين السابقة",
        years.length
          ? "اختر العام الدراسي المطلوب."
          : "لا توجد سنوات مؤرشفة حتى الآن.",
      ),
      archivesKeyboard(years, "nav:archive", "nav:home"),
    );
  }
  if (area === "nav" && action === "archive" && Number.isSafeInteger(id)) {
    const year = await content.archiveYear(id);
    if (!year) return sendHome(ctx);
    const levels = await content.levels(id);
    return show(
      ctx,
      section(
        `أرشيف ${year.title}`,
        levels.length
          ? "اختر الفرقة لاستعراض محتوياتها."
          : "لا توجد فرق في هذا الأرشيف بعد.",
      ),
      levelsKeyboard(levels, "nav:al", "nav:archives"),
    );
  }
  if (
    area === "nav" &&
    (action === "l" || action === "al") &&
    Number.isSafeInteger(id)
  ) {
    const level = await content.level(id);
    if (!level || !level.active) return sendHome(ctx);
    const terms = await content.terms(id);
    const back =
      level.archive_year_id === null
        ? "nav:home"
        : `nav:archive:${level.archive_year_id}`;
    return show(
      ctx,
      section(
        level.title,
        terms.length
          ? "اختر الفصل الدراسي."
          : "لا توجد فصول دراسية مضافة لهذه الفرقة بعد.",
      ),
      termsKeyboard(terms, "nav:t", back),
    );
  }
  if (area === "nav" && action === "t" && Number.isSafeInteger(id)) {
    const term = await content.term(id);
    if (!term || !term.active) return sendHome(ctx);
    const level = await content.level(term.level_id);
    const courses = await content.courses(id);
    const back =
      level?.archive_year_id === null
        ? `nav:l:${term.level_id}`
        : `nav:al:${term.level_id}`;
    return show(
      ctx,
      section(
        term.title,
        courses.length
          ? "اختر المقرر."
          : "لا توجد مقررات في هذا الفصل حتى الآن.",
      ),
      coursesKeyboard(courses, "nav:c", back),
    );
  }
  if (area === "nav" && action === "c" && Number.isSafeInteger(id)) {
    const course = await content.course(id);
    if (!course || !course.active) return sendHome(ctx);
    const folders = await content.folders();
    const term = await content.term(course.term_id);
    const back = term ? `nav:t:${term.id}` : "nav:home";
    return show(
      ctx,
      section(
        course.title,
        folders.length ? "اختر نوع المحتوى." : "لم تُضف مجلدات محتوى بعد.",
      ),
      foldersKeyboard(folders, `nav:f:${id}`, back),
    );
  }
  if (
    area === "nav" &&
    action === "f" &&
    Number.isSafeInteger(id) &&
    Number.isSafeInteger(other)
  ) {
    const files = await content.resources(id, other);
    const folder = (await content.folders(false)).find(
      (item) => item.id === other,
    );
    const keyboard = new InlineKeyboard();
    for (const file of files) {
      keyboard
        .text(
          file.title ?? file.file_name ?? `ملف ${file.id}`,
          `nav:r:${file.id}`,
        )
        .row();
    }
    withNavigation(keyboard, `nav:c:${id}`);
    return show(
      ctx,
      section(
        folder?.title ?? "المحتوى",
        files.length
          ? `عدد الملفات: ${files.length}`
          : "لا توجد ملفات هنا بعد. ستظهر المواد الجديدة هنا عند إضافتها.",
      ),
      keyboard,
    );
  }
  if (area === "nav" && action === "r" && Number.isSafeInteger(id)) {
    const resource = await content.resource(id);
    if (!resource)
      return show(
        ctx,
        section("الملف غير متاح", "قد يكون قد نُقل أو حُذف."),
        navigation("nav:home"),
      );
    const course = await content.course(resource.course_id);
    const term = course ? await content.term(course.term_id) : undefined;
    const level = term ? await content.level(term.level_id) : undefined;
    const folder = (await content.folders()).find(
      (item) => item.id === resource.folder_id,
    );
    if (!course?.active || !term?.active || !level?.active || !folder) {
      return show(
        ctx,
        section("الملف غير متاح", "لم يعد هذا المحتوى منشورًا للطلاب."),
        navigation("nav:home"),
      );
    }
    return sendResource(ctx, resource);
  }
  if (data === "nav:search") {
    if (ctx.from) await users.setState(ctx.from.id, { kind: "search" });
    return show(
      ctx,
      section(
        "بحث في الموارد",
        "أرسل كلمة مفتاحية للبحث في أسماء المقررات والملفات.",
      ),
      navigation("nav:home"),
    );
  }
  if (data === "nav:my") {
    const preferred = ctx.from
      ? await users.preferredLevel(ctx.from.id)
      : undefined;
    if (preferred) {
      const level = await content.level(preferred.levelId);
      const term = preferred.termId
        ? await content.term(preferred.termId)
        : undefined;
      if (level?.active && (preferred.termId === null || term?.active)) {
        const keyboard = navigation("nav:home");
        keyboard.row().text("✏️ تغيير الفرقة أو الفصل", "my:choose");
        const current = term ? `${level.title} · ${term.title}` : level.title;
        keyboard
          .row()
          .text(
            "متابعة التصفح",
            term ? `nav:t:${term.id}` : `nav:l:${level.id}`,
          );
        return show(
          ctx,
          section("فرقتي الحالية", `اختيارك المحفوظ: ${current}`),
          keyboard,
        );
      }
    }
    const levels = await content.levels();
    return show(
      ctx,
      section(
        "فرقتي الحالية",
        "اختر فرقتك لحفظها للوصول السريع. يمكنك الاستمرار في تصفح بقية المحتوى بحرية.",
      ),
      levelsKeyboard(levels, "my:l", "nav:home"),
    );
  }
  if (data === "my:choose") {
    const levels = await content.levels();
    return show(
      ctx,
      section("تغيير فرقتي الحالية", "اختر فرقتك ثم الفصل الدراسي الذي تفضله."),
      levelsKeyboard(levels, "my:l", "nav:my"),
    );
  }
  if (area === "my" && action === "l" && Number.isSafeInteger(id)) {
    const level = await content.level(id);
    if (!level?.active || level.archive_year_id !== null) return sendHome(ctx);
    const terms = await content.terms(id);
    const keyboard = termsKeyboard(terms, "my:t", "nav:my");
    keyboard.row().text("حفظ الفرقة فقط", `my:skip:${id}`);
    return show(
      ctx,
      section("اختيار الفصل", "اختر فصلك الدراسي، أو احفظ الفرقة فقط."),
      keyboard,
    );
  }
  if (area === "my" && action === "skip" && Number.isSafeInteger(id)) {
    if (ctx.from) await users.savePreferredLevel(ctx.from.id, id, null);
    return show(
      ctx,
      section(
        "تم حفظ فرقتك",
        "يمكنك فتح «فرقتي الحالية» في أي وقت، مع بقاء جميع الفرق متاحة للتصفح.",
      ),
      navigation("nav:home"),
    );
  }
  if (area === "my" && action === "t" && Number.isSafeInteger(id)) {
    const term = await content.term(id);
    if (term?.active && ctx.from)
      await users.savePreferredLevel(ctx.from.id, term.level_id, term.id);
    return show(
      ctx,
      section(
        "تم حفظ الفرقة والفصل",
        "ستجد اختيارك محفوظًا في «فرقتي الحالية».",
      ),
      navigation("nav:home"),
    );
  }
  if (data === "nav:about") {
    return show(
      ctx,
      section(
        "نبذة عن AGR Study",
        "منصة تعليمية منظمة للوصول إلى الكتب والمحاضرات والسكاشن والملخصات والامتحانات السابقة وأرشيف السنوات.\n\nابدأ باختيار الفرقة ثم الفصل والمقرر ونوع المحتوى، أو استخدم البحث للوصول السريع.\n\nالإصدار: " +
          env.appVersion +
          "\nالحالة: تعمل الخدمة عبر Telegram.",
      ),
      navigation("nav:home"),
    );
  }
  if (data === "nav:contact") {
    const keyboard = navigation("nav:home");
    keyboard.row().text("✍️ إرسال رسالة أو اقتراح", "nav:feedback");
    return show(
      ctx,
      section(
        "تواصل معنا",
        `للدعم والاستفسارات:\n${env.supportContact}\n\nيمكنك أيضًا إرسال رسالة مباشرة لفريق المنصة.`,
      ),
      keyboard,
    );
  }
  if (data === "nav:feedback") {
    if (ctx.from) await users.setState(ctx.from.id, { kind: "feedback" });
    return show(
      ctx,
      section(
        "رسالة لفريق المنصة",
        "أرسل رسالتك أو اقتراحك الآن. يدعم البوت النصوص والصور والملفات.",
      ),
      navigation("nav:contact"),
    );
  }

  if (data.startsWith("adm:")) {
    if (!isAdmin(ctx.from?.id))
      return show(
        ctx,
        section("غير مصرح", "هذا الإجراء مخصص للإدارة."),
        navigation("nav:home"),
      );
    return routeAdminCallback(ctx, parts);
  }
  if (data.startsWith("up:")) {
    if (!isAdmin(ctx.from?.id))
      return show(
        ctx,
        section("غير مصرح", "هذا الإجراء مخصص للإدارة."),
        navigation("nav:home"),
      );
    return routeUploadCallback(ctx, parts);
  }
}

async function sendResource(ctx: Context, resource: Resource): Promise<void> {
  const caption =
    [resource.title, resource.caption]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 1000) || "مورد من AGR Study";
  const options = { caption };
  switch (resource.file_type) {
    case "photo":
      await ctx.replyWithPhoto(resource.file_id, options);
      break;
    case "video":
      await ctx.replyWithVideo(resource.file_id, options);
      break;
    case "audio":
      await ctx.replyWithAudio(resource.file_id, options);
      break;
    case "animation":
      await ctx.replyWithAnimation(resource.file_id, options);
      break;
    case "voice":
      await ctx.replyWithVoice(resource.file_id, options);
      break;
    default:
      await ctx.replyWithDocument(resource.file_id, {
        ...options,
        ...(resource.file_name ? { filename: resource.file_name } : {}),
      });
      break;
  }
  await ctx.reply("يمكنك متابعة التصفح من هنا:", {
    reply_markup: navigation(
      `nav:f:${resource.course_id}:${resource.folder_id}`,
    ),
  });
}

async function showAdmin(ctx: Context): Promise<void> {
  const keyboard = new InlineKeyboard()
    .text("📚 إدارة الفرق والمقررات", "adm:levels")
    .row()
    .text("🗂 إدارة مجلدات المحتوى", "adm:folders")
    .row()
    .text("🕰 إدارة أرشيف السنوات", "adm:archive")
    .row()
    .text("📤 رفع ملفات", "adm:upload")
    .row()
    .text("📣 إرسال إعلان", "adm:broadcast")
    .row()
    .text(labels.main, "nav:home");
  await show(
    ctx,
    section(
      "لوحة الإدارة",
      "تحكم في المحتوى والهيكل الأكاديمي والإعلانات من داخل Telegram.",
    ),
    keyboard,
  );
}

async function showAdminLevels(ctx: Context): Promise<void> {
  const levels = await content.levels(null, false);
  const keyboard = new InlineKeyboard();
  keyboard.text("＋ إضافة فرقة", "adm:addlevel").row();
  for (const level of levels) {
    keyboard
      .text(level.title, `adm:lv:${level.id}`)
      .text(level.active ? "إخفاء" : "إظهار", `adm:hide:${level.id}`)
      .row();
    keyboard.text("✏️ إعادة تسمية", `adm:rename:level:${level.id}`).row();
  }
  withNavigation(keyboard, "adm:home");
  await show(
    ctx,
    section("إدارة الفرق", "يمكنك إخفاء فرقة من قائمة الطلاب دون حذف محتواها."),
    keyboard,
  );
}

async function showAdminLevel(ctx: Context, levelId: number): Promise<void> {
  const level = await content.level(levelId);
  if (!level) return showAdminLevels(ctx);
  const terms = await content.terms(levelId, false);
  const keyboard = new InlineKeyboard()
    .text("＋ إضافة فصل", `adm:addterm:${levelId}`)
    .row();
  for (const term of terms) {
    keyboard
      .text(term.title, `adm:tm:${term.id}`)
      .text(term.active ? "إخفاء" : "إظهار", `adm:hideterm:${term.id}`)
      .row();
    keyboard.text("✏️ إعادة تسمية الفصل", `adm:rename:term:${term.id}`).row();
  }
  keyboard.text("✏️ إعادة تسمية الفرقة", `adm:rename:level:${levelId}`).row();
  withNavigation(keyboard, "adm:levels");
  await show(
    ctx,
    section(
      `إدارة ${level.title}`,
      terms.length ? "اختر فصلًا لإدارة مقرراته." : "لا توجد فصول بعد.",
    ),
    keyboard,
  );
}

async function showAdminTerm(ctx: Context, termId: number): Promise<void> {
  const term = await content.term(termId);
  if (!term) return showAdminLevels(ctx);
  const courses = await content.courses(termId, false);
  const keyboard = new InlineKeyboard()
    .text("＋ إضافة مقرر", `adm:addcourse:${termId}`)
    .row();
  for (const course of courses) {
    keyboard
      .text(course.title, `adm:cr:${course.id}`)
      .text(course.active ? "إخفاء" : "إظهار", `adm:hidecourse:${course.id}`)
      .row();
    keyboard
      .text("✏️ إعادة تسمية المقرر", `adm:rename:course:${course.id}`)
      .row();
  }
  keyboard.text("✏️ إعادة تسمية الفصل", `adm:rename:term:${termId}`).row();
  withNavigation(keyboard, `adm:lv:${term.level_id}`);
  await show(
    ctx,
    section(
      `إدارة ${term.title}`,
      courses.length ? "اختر مقررًا لإدارته." : "لا توجد مقررات بعد.",
    ),
    keyboard,
  );
}

async function showAdminCourse(ctx: Context, courseId: number): Promise<void> {
  const course = await content.course(courseId);
  if (!course) return showAdminLevels(ctx);
  const keyboard = new InlineKeyboard()
    .text("📤 رفع ملفات لهذا المقرر", `up:c:${courseId}`)
    .row()
    .text("✏️ إعادة تسمية المقرر", `adm:rename:course:${courseId}`)
    .row();
  withNavigation(keyboard, `adm:tm:${course.term_id}`);
  await show(
    ctx,
    section(course.title, "إدارة بيانات المقرر أو إضافة ملفات إلى مجلداته."),
    keyboard,
  );
}

async function showAdminFolders(ctx: Context): Promise<void> {
  const folders = await content.folders(false);
  const keyboard = new InlineKeyboard()
    .text("＋ إضافة مجلد", "adm:addfolder")
    .row();
  for (const folder of folders) {
    keyboard
      .text(folder.title, `adm:folder:${folder.id}`)
      .text(folder.active ? "إخفاء" : "إظهار", `adm:ft:${folder.id}`)
      .row()
      .text("✏️", `adm:rename:folder:${folder.id}`)
      .text("↑", `adm:fu:${folder.id}`)
      .text("↓", `adm:fd:${folder.id}`)
      .row();
  }
  withNavigation(keyboard, "adm:home");
  await show(
    ctx,
    section(
      "مجلدات المحتوى",
      "تظهر المجلدات النشطة للطلاب. استخدم الأسهم لتغيير ترتيب العرض.",
    ),
    keyboard,
  );
}

async function showAdminFolder(ctx: Context, folderId: number): Promise<void> {
  const folder = (await content.folders(false)).find(
    (item) => item.id === folderId,
  );
  if (!folder) return showAdminFolders(ctx);
  const keyboard = new InlineKeyboard()
    .text("✏️ إعادة تسمية", `adm:rename:folder:${folder.id}`)
    .text(folder.active ? "إخفاء" : "إظهار", `adm:ft:${folder.id}`)
    .row()
    .text("↑", `adm:fu:${folder.id}`)
    .text("↓", `adm:fd:${folder.id}`);
  withNavigation(keyboard, "adm:folders");
  await show(
    ctx,
    section(
      folder.title,
      folder.active ? "هذا المجلد ظاهر للطلاب." : "هذا المجلد مخفي عن الطلاب.",
    ),
    keyboard,
  );
}

async function showAdminArchives(ctx: Context): Promise<void> {
  const years = await content.archiveYears();
  const keyboard = new InlineKeyboard()
    .text("＋ إنشاء سنة أرشيف", "adm:addarchive")
    .row();
  for (const year of years)
    keyboard.text(year.title, `adm:year:${year.id}`).row();
  withNavigation(keyboard, "adm:home");
  await show(
    ctx,
    section(
      "أرشيف السنوات السابقة",
      "أنشئ عامًا ثم انسخ إليه بنية فرقة ومواردها، أو أضف بنية أرشيفية يدويًا.",
    ),
    keyboard,
  );
}

async function showAdminArchiveYear(
  ctx: Context,
  archiveYearId: number,
): Promise<void> {
  const year = await content.archiveYear(archiveYearId);
  if (!year) return showAdminArchives(ctx);
  const levels = await content.levels(archiveYearId, false);
  const keyboard = new InlineKeyboard()
    .text("📦 نسخ فرقة حالية إلى هذا الأرشيف", `adm:snap:${archiveYearId}`)
    .row()
    .text("＋ إضافة فرقة أرشيفية يدويًا", `adm:addarchlevel:${archiveYearId}`)
    .row();
  for (const level of levels)
    keyboard.text(level.title, `adm:lv:${level.id}`).row();
  withNavigation(keyboard, "adm:archive");
  await show(
    ctx,
    section(
      `أرشيف ${year.title}`,
      levels.length
        ? "اختر بنية محفوظة أو أضف نسخة جديدة."
        : "الأرشيف فارغ حتى الآن.",
    ),
    keyboard,
  );
}

async function routeAdminCallback(
  ctx: Context,
  parts: string[],
): Promise<void> {
  const [, action, raw, extra] = parts;
  const id = Number(raw);
  if (action === "home") return showAdmin(ctx);
  if (action === "levels") return showAdminLevels(ctx);
  if (action === "folders") return showAdminFolders(ctx);
  if (action === "archive") return showAdminArchives(ctx);
  if (action === "upload") {
    const levels = await content.levels();
    return show(
      ctx,
      section("رفع ملفات", "اختر الفرقة ثم الفصل والمقرر ومجلد الوجهة."),
      levelsKeyboard(levels, "up:l", "adm:home"),
    );
  }
  if (action === "broadcast") {
    const keyboard = new InlineKeyboard()
      .text("📣 جميع المستخدمين", "adm:bl:all")
      .row()
      .text("🎓 فرقة محددة", "adm:bl:level")
      .row()
      .text("📘 فصل محدد", "adm:bl:term")
      .row();
    withNavigation(keyboard, "adm:home");
    return show(
      ctx,
      section(
        "إرسال إعلان",
        "اختر جمهور الإعلان. يمكن إرسال نص أو صورة أو مستند أو أي رسالة Telegram.",
      ),
      keyboard,
    );
  }
  if (action === "bl" && raw === "all") {
    await setBroadcastState(ctx, "all");
    return show(
      ctx,
      section(
        "نص الإعلان",
        "أرسل الرسالة أو الوسائط التي تريد نسخها إلى الجمهور المحدد.",
      ),
      navigation("adm:broadcast"),
    );
  }
  if (action === "bl" && raw === "level") {
    const levels = await content.levels();
    return show(
      ctx,
      section(
        "اختيار الفرقة",
        "سيصل الإعلان إلى المستخدمين الذين حفظوا هذه الفرقة.",
      ),
      levelsKeyboard(levels, "adm:bllevel", "adm:broadcast"),
    );
  }
  if (action === "bl" && raw === "term") {
    const levels = await content.levels();
    return show(
      ctx,
      section("اختيار الفرقة", "اختر الفرقة للوصول إلى فصولها."),
      levelsKeyboard(levels, "adm:blterm", "adm:broadcast"),
    );
  }
  if (action === "bllevel" && Number.isSafeInteger(id)) {
    await setBroadcastState(ctx, "level", id);
    return show(
      ctx,
      section(
        "نص الإعلان",
        "أرسل الرسالة أو الوسائط لإرسالها إلى جمهور هذه الفرقة.",
      ),
      navigation("adm:broadcast"),
    );
  }
  if (action === "blterm" && Number.isSafeInteger(id)) {
    const terms = await content.terms(id);
    return show(
      ctx,
      section(
        "اختيار الفصل",
        "سيصل الإعلان إلى المستخدمين الذين حفظوا هذا الفصل.",
      ),
      termsKeyboard(terms, `adm:bltermid`, "adm:broadcast"),
    );
  }
  if (action === "bltermid" && Number.isSafeInteger(id)) {
    await setBroadcastState(ctx, "term", id);
    return show(
      ctx,
      section(
        "نص الإعلان",
        "أرسل الرسالة أو الوسائط لإرسالها إلى جمهور هذا الفصل.",
      ),
      navigation("adm:broadcast"),
    );
  }
  if (action === "addlevel") {
    if (ctx.from)
      await users.setState(ctx.from.id, { kind: "text", action: "add-level" });
    return show(
      ctx,
      section("إضافة فرقة", "أرسل اسم الفرقة الجديدة."),
      navigation("adm:levels"),
    );
  }
  if (action === "addterm" && Number.isSafeInteger(id)) {
    if (ctx.from)
      await users.setState(ctx.from.id, {
        kind: "text",
        action: "add-term",
        parentId: id,
      });
    return show(
      ctx,
      section("إضافة فصل", "أرسل اسم الفصل الدراسي."),
      navigation(`adm:lv:${id}`),
    );
  }
  if (action === "addcourse" && Number.isSafeInteger(id)) {
    if (ctx.from)
      await users.setState(ctx.from.id, {
        kind: "text",
        action: "add-course",
        parentId: id,
      });
    return show(
      ctx,
      section("إضافة مقرر", "أرسل اسم المقرر."),
      navigation(`adm:tm:${id}`),
    );
  }
  if (action === "addfolder") {
    if (ctx.from)
      await users.setState(ctx.from.id, { kind: "text", action: "add-folder" });
    return show(
      ctx,
      section(
        "إضافة مجلد",
        "أرسل اسم المجلد بالعربية أو الإنجليزية (مثل: مشاريع).",
      ),
      navigation("adm:folders"),
    );
  }
  if (
    action === "rename" &&
    ["level", "term", "course", "folder"].includes(raw ?? "") &&
    Number.isSafeInteger(Number(extra))
  ) {
    const entity = raw as "level" | "term" | "course" | "folder";
    if (ctx.from)
      await users.setState(ctx.from.id, {
        kind: "text",
        action: "rename",
        entity,
        entityId: Number(extra),
      });
    return show(
      ctx,
      section("إعادة تسمية", "أرسل الاسم الجديد."),
      navigation("adm:home"),
    );
  }
  if (action === "hide" && Number.isSafeInteger(id)) {
    await study.toggleLevel(id);
    return showAdminLevels(ctx);
  }
  if (action === "hideterm" && Number.isSafeInteger(id)) {
    await study.toggleTerm(id);
    const term = await content.term(id);
    if (term) return showAdminLevel(ctx, term.level_id);
    return showAdminLevels(ctx);
  }
  if (action === "hidecourse" && Number.isSafeInteger(id)) {
    await study.toggleCourse(id);
    const course = await content.course(id);
    if (course) return showAdminTerm(ctx, course.term_id);
    return showAdminLevels(ctx);
  }
  if (action === "ft" && Number.isSafeInteger(id)) {
    await study.toggleFolder(id);
    return showAdminFolders(ctx);
  }
  if (action === "folder" && Number.isSafeInteger(id))
    return showAdminFolder(ctx, id);
  if (action === "fu" && Number.isSafeInteger(id)) {
    await study.moveFolder(id, -1);
    return showAdminFolders(ctx);
  }
  if (action === "fd" && Number.isSafeInteger(id)) {
    await study.moveFolder(id, 1);
    return showAdminFolders(ctx);
  }
  if (action === "lv" && Number.isSafeInteger(id))
    return showAdminLevel(ctx, id);
  if (action === "tm" && Number.isSafeInteger(id))
    return showAdminTerm(ctx, id);
  if (action === "cr" && Number.isSafeInteger(id))
    return showAdminCourse(ctx, id);
  if (action === "noop") return;
  if (action === "addarchive") {
    if (ctx.from)
      await users.setState(ctx.from.id, {
        kind: "text",
        action: "create-archive",
      });
    return show(
      ctx,
      section("إنشاء أرشيف", "أرسل اسم الفترة الأكاديمية، مثل 2024-2025."),
      navigation("adm:archive"),
    );
  }
  if (action === "year" && Number.isSafeInteger(id))
    return showAdminArchiveYear(ctx, id);
  if (action === "addarchlevel" && Number.isSafeInteger(id)) {
    if (ctx.from)
      await users.setState(ctx.from.id, {
        kind: "text",
        action: "add-level",
        archiveYearId: id,
      });
    return show(
      ctx,
      section("إضافة فرقة للأرشيف", "أرسل اسم الفرقة المحفوظة."),
      navigation(`adm:year:${id}`),
    );
  }
  if (action === "snap" && Number.isSafeInteger(id)) {
    const levels = await content.levels();
    return show(
      ctx,
      section(
        "اختيار فرقة للأرشفة",
        "سيتم نسخ الفصول والمقررات والموارد، ثم إخفاء الفرقة الحالية من القائمة النشطة.",
      ),
      levelsKeyboard(levels, `adm:clone:${id}`, `adm:year:${id}`),
    );
  }
  if (
    action === "clone" &&
    Number.isSafeInteger(id) &&
    Number.isSafeInteger(Number(extra))
  ) {
    await study.snapshotLevel(Number(extra), id);
    return showAdminArchiveYear(ctx, id);
  }
}

async function routeUploadCallback(
  ctx: Context,
  parts: string[],
): Promise<void> {
  const [, action, raw, otherRaw] = parts;
  const id = Number(raw);
  if (action === "l" && Number.isSafeInteger(id)) {
    const terms = await content.terms(id);
    return show(
      ctx,
      section("رفع ملفات", "اختر الفصل الدراسي."),
      termsKeyboard(terms, "up:t", "adm:upload"),
    );
  }
  if (action === "t" && Number.isSafeInteger(id)) {
    const courses = await content.courses(id);
    return show(
      ctx,
      section("رفع ملفات", "اختر المقرر."),
      coursesKeyboard(courses, "up:c", "adm:upload"),
    );
  }
  if (action === "c" && Number.isSafeInteger(id)) {
    const folders = await content.folders();
    return show(
      ctx,
      section("وجهة الملفات", "اختر المجلد الذي ستُحفظ فيه الملفات."),
      foldersKeyboard(folders, `up:f:${id}`, `adm:cr:${id}`),
    );
  }
  if (
    action === "f" &&
    Number.isSafeInteger(id) &&
    Number.isSafeInteger(Number(otherRaw))
  ) {
    if (ctx.from)
      await users.setState(ctx.from.id, {
        kind: "upload",
        courseId: Number(otherRaw),
        folderId: id,
      });
    return show(
      ctx,
      section(
        "رفع الملفات",
        "أرسل ملفًا أو صورة أو فيديو. يمكنك إرسال عدة ملفات بالتتابع، ثم اكتب /done عند الانتهاء. سيُحفظ الاسم والوصف الموجودان مع الملف.",
      ),
      navigation("adm:upload"),
    );
  }
}

async function setBroadcastState(
  ctx: Context,
  target: "all" | "level" | "term",
  targetId?: number,
): Promise<void> {
  if (!ctx.from) return;
  const state: AdminState = {
    kind: "broadcast-message",
    target,
    ...(targetId === undefined ? {} : { targetId }),
  };
  await users.setState(ctx.from.id, state, 60 * 60 * 1000);
}

interface IncomingFile {
  id: string;
  uniqueId: string;
  type: string;
  fileName?: string;
  mimeType?: string;
}

function incomingFile(ctx: Context): IncomingFile | undefined {
  const message = ctx.message;
  if (!message) return undefined;
  if ("document" in message) {
    return {
      id: message.document.file_id,
      uniqueId: message.document.file_unique_id,
      type: "document",
      ...(message.document.file_name
        ? { fileName: message.document.file_name }
        : {}),
      ...(message.document.mime_type
        ? { mimeType: message.document.mime_type }
        : {}),
    };
  }
  if ("photo" in message) {
    const photo = message.photo.at(-1);
    return photo
      ? { id: photo.file_id, uniqueId: photo.file_unique_id, type: "photo" }
      : undefined;
  }
  if ("video" in message) {
    return {
      id: message.video.file_id,
      uniqueId: message.video.file_unique_id,
      type: "video",
      ...(message.video.file_name ? { fileName: message.video.file_name } : {}),
      ...(message.video.mime_type ? { mimeType: message.video.mime_type } : {}),
    };
  }
  if ("audio" in message) {
    return {
      id: message.audio.file_id,
      uniqueId: message.audio.file_unique_id,
      type: "audio",
      ...(message.audio.file_name ? { fileName: message.audio.file_name } : {}),
      ...(message.audio.mime_type ? { mimeType: message.audio.mime_type } : {}),
    };
  }
  if ("animation" in message)
    return {
      id: message.animation.file_id,
      uniqueId: message.animation.file_unique_id,
      type: "animation",
    };
  if ("voice" in message)
    return {
      id: message.voice.file_id,
      uniqueId: message.voice.file_unique_id,
      type: "voice",
    };
  return undefined;
}

async function handleState(ctx: Context, state: AdminState): Promise<void> {
  const userId = ctx.from?.id;
  const message = ctx.message;
  if (!userId || !message) return;
  if (message.text === "/cancel") {
    await users.clearState(userId);
    return show(ctx, section("تم إلغاء العملية"), navigation("nav:home"));
  }
  if (message.text === "/done" && state.kind === "upload") {
    await users.clearState(userId);
    return show(
      ctx,
      section("اكتمل رفع الملفات", "تم حفظ جميع الملفات المرسلة."),
      navigation("adm:home"),
    );
  }
  if (state.kind === "upload") {
    if (!isAdmin(userId)) {
      await users.clearState(userId);
      await ctx.reply("انتهت صلاحية هذه العملية.");
      return;
    }
    const file = incomingFile(ctx);
    if (!file) {
      await ctx.reply(
        "أرسل مستندًا أو صورة أو فيديو أو ملفًا صوتيًا. اكتب /done للإنهاء.",
      );
      return;
    }
    const title = message.caption?.trim();
    await study.addResource({
      courseId: state.courseId,
      folderId: state.folderId,
      fileId: file.id,
      fileUniqueId: file.uniqueId,
      fileType: file.type,
      ...(file.fileName ? { fileName: file.fileName } : {}),
      ...(file.mimeType ? { mimeType: file.mimeType } : {}),
      ...(title ? { title } : {}),
      ...(message.caption ? { caption: message.caption } : {}),
      createdBy: userId,
    });
    if (env.archiveChannelId) {
      try {
        await ctx.api.sendMessage(
          env.archiveChannelId,
          `AGR Study resource\nCourse ID: ${state.courseId}\nFolder ID: ${state.folderId}\nTitle: ${title ?? file.fileName ?? "untitled"}\nfile_id: ${file.id}\nfile_unique_id: ${file.uniqueId}`,
        );
        await ctx.api.copyMessage(
          env.archiveChannelId,
          message.chat.id,
          message.message_id,
        );
      } catch (error) {
        console.error("Archive channel backup failed:", error);
      }
    }
    await ctx.reply("✅ تم حفظ الملف. يمكنك إرسال ملف آخر أو كتابة /done.", {
      reply_markup: navigation("adm:home"),
    });
    return;
  }
  if (state.kind === "feedback") {
    for (const adminId of env.adminIds) {
      await ctx.api.sendMessage(
        adminId,
        `رسالة دعم جديدة من ${message.from.first_name} (ID: ${userId})${message.from.username ? ` @${message.from.username}` : ""}`,
      );
      await ctx.api.copyMessage(adminId, message.chat.id, message.message_id);
    }
    await users.clearState(userId);
    await ctx.reply(
      "وصلت رسالتك إلى فريق AGR Study. شكرًا لمساعدتنا على التطوير.",
      { reply_markup: navigation("nav:home") },
    );
    return;
  }
  if (state.kind === "search") {
    if (!message.text?.trim()) {
      await ctx.reply("أرسل كلمة نصية للبحث.");
      return;
    }
    const results = await content.search(message.text.trim().slice(0, 100));
    const courses = await content.searchCourses(
      message.text.trim().slice(0, 100),
    );
    const keyboard = new InlineKeyboard();
    for (const course of courses) {
      const archive = course.archive_title ? ` · ${course.archive_title}` : "";
      keyboard
        .text(
          `📘 ${course.title} · ${course.level_title}${archive}`,
          `nav:c:${course.id}`,
        )
        .row();
    }
    for (const item of results) {
      const name = item.title ?? item.file_name ?? item.course_title;
      const archive = item.archive_title ? ` · ${item.archive_title}` : "";
      keyboard
        .text(`${name} · ${item.course_title}${archive}`, `nav:r:${item.id}`)
        .row();
    }
    withNavigation(keyboard, "nav:home");
    await users.clearState(userId);
    const count = results.length + courses.length;
    return show(
      ctx,
      section(
        "نتائج البحث",
        count
          ? `عُثر على ${count} نتيجة بين المقررات والموارد.`
          : "لم نعثر على نتائج. جرّب كلمة أخرى أو استخدم اسم المقرر.",
      ),
      keyboard,
    );
  }
  if (state.kind === "text") {
    if (!isAdmin(userId)) {
      await users.clearState(userId);
      await ctx.reply("هذا الإجراء مخصص للإدارة.");
      return;
    }
    const title = message.text?.trim();
    if (!title || title.startsWith("/")) {
      await ctx.reply("أرسل نصًا صالحًا، أو استخدم /cancel للإلغاء.");
      return;
    }
    if (title.length > 100) {
      await ctx.reply("الاسم طويل جدًا. استخدم 100 حرف أو أقل.");
      return;
    }
    switch (state.action) {
      case "add-level":
        await study.createLevel(title, state.archiveYearId ?? null);
        await users.clearState(userId);
        return show(
          ctx,
          section("تمت إضافة الفرقة", title),
          state.archiveYearId
            ? navigation(`adm:year:${state.archiveYearId}`)
            : navigation("adm:levels"),
        );
      case "add-term":
        if (state.parentId === undefined)
          throw new Error("Missing level for new term.");
        await study.createTerm(state.parentId, title);
        await users.clearState(userId);
        return show(
          ctx,
          section("تمت إضافة الفصل", title),
          navigation(`adm:lv:${state.parentId}`),
        );
      case "add-course":
        if (state.parentId === undefined)
          throw new Error("Missing term for new course.");
        await study.createCourse(state.parentId, title);
        await users.clearState(userId);
        return show(
          ctx,
          section("تمت إضافة المقرر", title),
          navigation(`adm:tm:${state.parentId}`),
        );
      case "add-folder":
        await study.createFolder(title);
        await users.clearState(userId);
        return show(
          ctx,
          section("تمت إضافة المجلد", title),
          navigation("adm:folders"),
        );
      case "create-archive": {
        const archiveId = await study.createArchiveYear(title);
        await users.clearState(userId);
        return showAdminArchiveYear(ctx, archiveId);
      }
      case "rename":
        if (
          !state.entityId ||
          !["level", "term", "course", "folder"].includes(state.entity ?? "")
        )
          throw new Error("Invalid rename target.");
        await study.rename(
          state.entity as "level" | "term" | "course" | "folder",
          state.entityId,
          title,
        );
        await users.clearState(userId);
        return show(
          ctx,
          section("تم تحديث الاسم", title),
          navigation("adm:home"),
        );
    }
  }
  if (state.kind === "broadcast-message") {
    if (!isAdmin(userId)) {
      await users.clearState(userId);
      await ctx.reply("هذا الإجراء مخصص للإدارة.");
      return;
    }
    await users.clearState(userId);
    scheduleBackgroundTask(
      (async () => {
        try {
          const report = await broadcast.send(
            bot,
            message,
            state.target,
            state.targetId,
          );
          await ctx.api.sendMessage(
            userId,
            `📣 اكتمل الإرسال\n━━━━━━━━━━━━━━\nالمستهدفون: ${report.attempted}\nتم التسليم: ${report.delivered}\nحسابات محظورة: ${report.blocked}\nإخفاقات أخرى: ${report.failed}`,
            { reply_markup: navigation("adm:home") },
          );
        } catch (error) {
          console.error("Broadcast job failed:", error);
          await ctx.api.sendMessage(
            userId,
            "تعذر إكمال الإعلان بالكامل بسبب خطأ في الخدمة. راجع سجلات Vercel للتفاصيل.",
          );
        }
      })(),
    );
    await ctx.reply(
      "بدأ إرسال الإعلان. سأرسل تقرير التسليم إلى هنا عند الانتهاء.",
      { reply_markup: navigation("adm:home") },
    );
    return;
  }
}

bot.on("message", async (ctx) => {
  const text = ctx.message.text;
  if (text?.startsWith("/")) {
    if (text === "/done" && isAdmin(ctx.from?.id)) {
      const state = ctx.from ? await users.getState(ctx.from.id) : undefined;
      if (state?.kind === "upload") {
        await handleState(ctx, state);
        return;
      }
    }
    return;
  }
  if (!ctx.from) return;
  const state = await users.getState(ctx.from.id);
  if (state) await handleState(ctx, state);
});

bot.catch((error) => {
  console.error("Telegram update failed:", error);
  const ctx = error.ctx;
  if (ctx.from) {
    void ctx
      .reply("تعذر إتمام هذا الطلب. يرجى المحاولة مرة أخرى.")
      .catch((replyError: unknown) => {
        console.error("Could not send error reply:", replyError);
      });
  }
});

export { bot };

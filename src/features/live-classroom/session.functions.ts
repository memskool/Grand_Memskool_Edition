import { createServerFn } from "@tanstack/react-start";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";
import {
  CorrectLiveAttendanceSchema,
  ModerateParticipantSchema,
  SendClassroomChatSchema,
  SessionIdSchema,
  StartLiveSessionSchema,
  type LiveSessionRecord,
} from "./contracts";

export const startLiveSession = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => StartLiveSessionSchema.parse(data))
  .handler(async (opts): Promise<LiveSessionRecord> => {
    const { startLiveSessionHandler } = await import("./session.server");
    return startLiveSessionHandler(opts);
  });

export const endLiveSession = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => SessionIdSchema.parse(data))
  .handler(async (opts) => {
    const { endLiveSessionHandler } = await import("./session.server");
    return endLiveSessionHandler(opts);
  });

export const cancelLiveSession = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => SessionIdSchema.parse(data))
  .handler(async (opts) => {
    const { cancelLiveSessionHandler } = await import("./session.server");
    return cancelLiveSessionHandler(opts);
  });

export const joinLiveSession = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => SessionIdSchema.parse(data))
  .handler(async (opts) => {
    const { joinLiveSessionHandler } = await import("./session.server");
    return joinLiveSessionHandler(opts);
  });

export const leaveLiveSession = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => SessionIdSchema.parse(data))
  .handler(async (opts) => {
    const { leaveLiveSessionHandler } = await import("./session.server");
    return leaveLiveSessionHandler(opts);
  });

export const reportLivePresence = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => SessionIdSchema.parse(data))
  .handler(async (opts) => {
    const { reportLivePresenceHandler } = await import("./session.server");
    return reportLivePresenceHandler(opts);
  });

export const sendClassroomChat = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => SendClassroomChatSchema.parse(data))
  .handler(async (opts) => {
    const { sendClassroomChatHandler } = await import("./session.server");
    return sendClassroomChatHandler(opts);
  });

export const moderateLiveParticipant = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => ModerateParticipantSchema.parse(data))
  .handler(async (opts) => {
    const { moderateLiveParticipantHandler } = await import("./session.server");
    return moderateLiveParticipantHandler(opts);
  });

export const correctLiveAttendance = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => CorrectLiveAttendanceSchema.parse(data))
  .handler(async (opts) => {
    const { correctLiveAttendanceHandler } = await import("./session.server");
    return correctLiveAttendanceHandler(opts);
  });

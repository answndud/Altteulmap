import { z } from "zod";

const nicknameSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().max(60, "닉네임은 60자 이하로 입력해주세요.").optional());

export const credentialsSignupSchema = z.object({
  email: z
    .string()
    .trim()
    .email("이메일 형식을 확인해주세요.")
    .max(255, "이메일은 255자 이하로 입력해주세요."),
  nickname: nicknameSchema,
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다.")
    .max(72, "비밀번호는 72자 이하로 입력해주세요."),
});

export type CredentialsSignupInput = z.infer<typeof credentialsSignupSchema>;

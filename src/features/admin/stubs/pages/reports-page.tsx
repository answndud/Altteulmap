import { redirect } from "next/navigation";

import { AccessDeniedPanel } from "@/components/access-denied-panel";
import {
  getAdminAppHref,
  hasExternalAdminApp,
} from "@/lib/admin-app";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  if (!hasExternalAdminApp()) {
    return (
      <AccessDeniedPanel
        eyebrow="운영"
        title="관리자 앱 주소가 필요합니다"
        description="ADMIN_APP_URL을 설정한 뒤 관리자 신고 화면을 외부 앱으로 연결하세요."
        primaryHref="/"
        primaryLabel="지도 화면으로 이동"
      />
    );
  }

  redirect(getAdminAppHref("/admin/reports"));
}

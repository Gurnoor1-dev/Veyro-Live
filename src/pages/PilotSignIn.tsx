import { Navigate, useParams } from "react-router-dom";

export default function PilotSignIn() {
  const { slug = "" } = useParams();
  const destination = "/login?next=" + encodeURIComponent("/" + slug + "/pilot");
  return <Navigate to={destination} replace />;
}

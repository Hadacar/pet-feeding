import { Redirect } from "expo-router";
import { useAuth } from "../context/AuthProvider";

const Page = () => {
  const { user, loading } = useAuth();

  if (loading) return null; // Prevent flickering while checking auth state

  return user ? <Redirect href="/(tabs)/HomeScreen" /> : <Redirect href="/sign-in" />;
};

export default Page;

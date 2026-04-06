import { Redirect, type Href } from "expo-router";

const OVERVIEW_TAB = "/(tabs)/overview" as Href;

export default function Index() {
  return <Redirect href={OVERVIEW_TAB} />;
}

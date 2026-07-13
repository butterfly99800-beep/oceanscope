import { CircleHelp, ClipboardList, Map, Route, ShipWheel } from "lucide-react";
import type { NavItem } from "@/types/navigation";

export const navItems: NavItem[] = [
  { label: "航运地图", href: "/atlas", icon: Map },
  { label: "船期查询", href: "/schedules", icon: Route },
  { label: "运费探索器", href: "/rates", icon: ShipWheel },
  { label: "我的订单", href: "/orders", icon: ClipboardList },
  { label: "帮助", href: "#help", icon: CircleHelp },
];

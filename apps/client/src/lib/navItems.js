import { BsCollection, BsFillCollectionFill } from "react-icons/bs";
import { IoSettingsOutline, IoSettingsSharp } from "react-icons/io5";
import { BiSolidHome, BiUser } from "react-icons/bi";
import { PiRocketDuotone, PiRocketFill } from "react-icons/pi";

export const navItems = [
  { href: "/", icon: BiSolidHome, iconFilled: null, label: "Home" },
  { href: "/collections", icon: BsCollection, iconFilled: BsFillCollectionFill, label: "Collections" },
  { href: "/create", icon: PiRocketDuotone, iconFilled: PiRocketFill, label: "Launchpool" },
  { href: "/profile", icon: BiUser, iconFilled: null, label: "Profile" },
  { href: "/settings", icon: IoSettingsOutline, iconFilled: IoSettingsSharp, label: "Settings" },
];
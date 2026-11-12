import os
import glob
from PIL import Image, ImageFilter, ImageDraw, ImageFont

def prepare_assets():
    out_dir = "play_store_assets"
    os.makedirs(out_dir, exist_ok=True)

    # 1. App Icon (512x512)
    icon_path = "app/src/main/res/drawable/app_icon.png"
    icon = Image.open(icon_path).convert("RGBA")
    
    # Calculate resize maintaining aspect ratio
    icon.thumbnail((512, 512), Image.Resampling.LANCZOS)
    
    # Paste onto 512x512 transparent background
    final_icon = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    x = (512 - icon.width) // 2
    y = (512 - icon.height) // 2
    final_icon.paste(icon, (x, y), icon)
    final_icon.save(os.path.join(out_dir, "app_icon_512.png"))
    print("Created App Icon (512x512)")

    # 2. Feature Graphic (1024x500)
    feature_graphic = Image.new("RGB", (1024, 500), "#1E1E1E")  # Dark background
    draw = ImageDraw.Draw(feature_graphic)
    # Draw subtle gradient or pattern (just a simple gradient)
    for i in range(1024):
        r = int(30 + (i / 1024) * 20)
        g = int(30 + (i / 1024) * 20)
        b = int(30 + (i / 1024) * 50)
        draw.line([(i, 0), (i, 500)], fill=(r, g, b))
    
    # Paste icon in the center
    icon_fg = icon.copy()
    icon_fg.thumbnail((300, 300), Image.Resampling.LANCZOS)
    fg_x = (1024 - icon_fg.width) // 2
    fg_y = (500 - icon_fg.height) // 2
    feature_graphic.paste(icon_fg, (fg_x, fg_y), icon_fg)
    feature_graphic.save(os.path.join(out_dir, "feature_graphic.png"))
    print("Created Feature Graphic (1024x500)")

    # 3. Screenshots (1080x1920)
    screenshots = glob.glob("screenshots/*.jpg")
    for idx, path in enumerate(screenshots):
        base_name = os.path.basename(path)
        img = Image.open(path).convert("RGB")
        
        # Calculate resize for 9:16 (height=1920)
        # Original is 1080x2400.
        target_w, target_h = 1080, 1920
        
        # Background: blur the original
        bg = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
        bg = bg.filter(ImageFilter.GaussianBlur(radius=20))
        # Darken the background slightly
        bg = bg.point(lambda p: p * 0.6)

        # Foreground: shrink to fit inside target_h
        scale = target_h / img.height
        new_w = int(img.width * scale)
        new_h = int(img.height * scale)
        fg = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        # Paste foreground onto background
        offset_x = (target_w - new_w) // 2
        offset_y = (target_h - new_h) // 2
        bg.paste(fg, (offset_x, offset_y))
        
        # Save phone screenshot
        phone_path = os.path.join(out_dir, f"phone_{idx+1}_{base_name}")
        bg.save(phone_path, quality=95)
        print(f"Created Phone Screenshot: {phone_path}")

        # Note: Play Store allows using phone screenshots for 7-inch and 10-inch tablets as well,
        # so we will just use these same files for tablet uploads.

if __name__ == "__main__":
    prepare_assets()

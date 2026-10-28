Add-Type -AssemblyName System.Drawing

$out = Join-Path $PWD 'output/dots-guide-diagrams'
$navy = [System.Drawing.Color]::FromArgb(18,63,89)
$teal = [System.Drawing.Color]::FromArgb(8,127,140)
$blue = [System.Drawing.Color]::FromArgb(27,102,128)
$ink = [System.Drawing.Color]::FromArgb(33,55,70)
$muted = [System.Drawing.Color]::FromArgb(93,115,128)
$background = [System.Drawing.Color]::FromArgb(242,247,249)
$green = [System.Drawing.Color]::FromArgb(229,244,238)
$amber = [System.Drawing.Color]::FromArgb(255,242,215)
$rose = [System.Drawing.Color]::FromArgb(250,233,235)
$red = [System.Drawing.Color]::FromArgb(168,68,80)
$white = [System.Drawing.Color]::White

function New-Canvas([string]$Title, [int]$Width, [int]$Height, [string]$Note) {
    $bitmap = [System.Drawing.Bitmap]::new($Width, $Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.Clear($background)
    $titleFont = [System.Drawing.Font]::new('Arial', 23, [System.Drawing.FontStyle]::Bold)
    $titleBrush = [System.Drawing.SolidBrush]::new($navy)
    $fmt = [System.Drawing.StringFormat]::new(); $fmt.Alignment = [System.Drawing.StringAlignment]::Center; $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $graphics.DrawString($Title, $titleFont, $titleBrush, [System.Drawing.RectangleF]::new(30, 8, $Width - 60, 48), $fmt)
    if ($Note) {
        $noteFont = [System.Drawing.Font]::new('Arial', 12)
        $noteBrush = [System.Drawing.SolidBrush]::new($muted)
        $graphics.DrawString($Note, $noteFont, $noteBrush, [System.Drawing.RectangleF]::new(35, $Height - 38, $Width - 70, 27), $fmt)
        $noteFont.Dispose(); $noteBrush.Dispose()
    }
    $titleFont.Dispose(); $titleBrush.Dispose(); $fmt.Dispose()
    return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Draw-Box($Graphics, [int]$X, [int]$Y, [int]$W, [int]$H, [string[]]$Lines, $Fill = $white, [string]$Tag = '') {
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $d = 24
    $path.AddArc($X, $Y, $d, $d, 180, 90); $path.AddArc($X + $W - $d, $Y, $d, $d, 270, 90)
    $path.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90); $path.AddArc($X, $Y + $H - $d, $d, $d, 90, 90); $path.CloseFigure()
    $brush = [System.Drawing.SolidBrush]::new($Fill); $pen = [System.Drawing.Pen]::new($navy, 2.5)
    $Graphics.FillPath($brush, $path); $Graphics.DrawPath($pen, $path)
    $fmt = [System.Drawing.StringFormat]::new(); $fmt.Alignment = [System.Drawing.StringAlignment]::Center; $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $lineHeight = 24; $totalHeight = $Lines.Count * $lineHeight; $startY = $Y + ($H - $totalHeight) / 2
    if ($Tag) { $startY = $Y + 43 }
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        $style = if ($i -eq 0) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
        $size = if ($i -eq 0) { 14 } else { 12 }
        $font = [System.Drawing.Font]::new('Arial', $size, $style)
        $textBrush = [System.Drawing.SolidBrush]::new($(if ($i -eq 0) { $ink } else { $muted }))
        $Graphics.DrawString($Lines[$i], $font, $textBrush, [System.Drawing.RectangleF]::new($X + 8, $startY + $i * $lineHeight, $W - 16, $lineHeight), $fmt)
        $font.Dispose(); $textBrush.Dispose()
    }
    if ($Tag) {
        $tagRect = [System.Drawing.RectangleF]::new($X + 12, $Y + 10, 90, 23)
        $tagBrush = [System.Drawing.SolidBrush]::new($blue); $Graphics.FillRectangle($tagBrush, $tagRect)
        $tagFont = [System.Drawing.Font]::new('Arial', 10, [System.Drawing.FontStyle]::Bold); $tagText = [System.Drawing.SolidBrush]::new($white)
        $Graphics.DrawString($Tag, $tagFont, $tagText, [System.Drawing.RectangleF]::new($tagRect.X + 4, $tagRect.Y + 1, $tagRect.Width - 8, $tagRect.Height - 2), $fmt)
        $tagBrush.Dispose(); $tagFont.Dispose(); $tagText.Dispose()
    }
    $fmt.Dispose(); $brush.Dispose(); $pen.Dispose(); $path.Dispose()
}

function Draw-ArrowPath($Graphics, [System.Drawing.PointF[]]$Points, $Color = $teal) {
    $pen = [System.Drawing.Pen]::new($Color, 4)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    for ($i = 0; $i -lt $Points.Count - 1; $i++) { $Graphics.DrawLine($pen, $Points[$i], $Points[$i + 1]) }
    $a = $Points[$Points.Count - 2]; $b = $Points[$Points.Count - 1]
    $dx = $b.X - $a.X; $dy = $b.Y - $a.Y; $len = [Math]::Sqrt($dx * $dx + $dy * $dy)
    if ($len -gt 0) {
        $ux = $dx / $len; $uy = $dy / $len; $baseX = $b.X - $ux * 16; $baseY = $b.Y - $uy * 16; $px = -$uy * 8; $py = $ux * 8
        $tri = [System.Drawing.PointF[]]@([System.Drawing.PointF]::new($b.X,$b.Y),[System.Drawing.PointF]::new($baseX+$px,$baseY+$py),[System.Drawing.PointF]::new($baseX-$px,$baseY-$py))
        $brush = [System.Drawing.SolidBrush]::new($Color); $Graphics.FillPolygon($brush, $tri); $brush.Dispose()
    }
    $pen.Dispose()
}

function Save-Canvas($Canvas, [string]$Name) {
    $path = Join-Path $out ($Name + '.png')
    $Canvas.Graphics.Dispose(); $Canvas.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $Canvas.Bitmap.Dispose()
}
function P([float]$X,[float]$Y) { [System.Drawing.PointF]::new($X,$Y) }

$c = New-Canvas 'DOTS sign-in and access checks' 1500 460 'Access to records and actions is checked again after sign-in.'
$g=$c.Graphics
Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 225 187),(P 260 187))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 480 187),(P 515 187))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 730 187),(P 765 187))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 985 187),(P 1020 187))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 1240 187),(P 1275 187)))
Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 370 250),(P 370 290),(P 430 290))) $blue; Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 875 250),(P 875 290),(P 940 290))) $blue
Draw-Box $g 35 125 190 125 @('Open DOTS','Sign-in page'); Draw-Box $g 260 125 220 125 @('Enter account','and password'); Draw-Box $g 515 125 215 125 @('Account checks','active • unlocked'); Draw-Box $g 765 125 220 125 @('Security checks','email / challenge'); Draw-Box $g 1020 125 220 125 @('Role + office','access checks'); Draw-Box $g 1275 125 190 125 @('Allowed','workspace') $green
Draw-Box $g 430 292 240 72 @('Forgot password?','Email reset link') $amber; Draw-Box $g 940 292 265 72 @('Repeated failures','may trigger CAPTCHA') $amber; Save-Canvas $c 'login'

$c = New-Canvas 'Document preparation and tracking' 1500 470 'Finalizing an authored file makes it ready for routing; registration assigns the tracking number.'; $g=$c.Graphics
Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 235 200),(P 270 200))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 475 200),(P 510 200))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 730 200),(P 765 200))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 950 200),(P 985 200))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 1175 200),(P 1210 200)))
Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 620 265),(P 620 325))) $blue; Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 1332 265),(P 1332 325))) $blue
Draw-Box $g 35 135 200 130 @('Prepare file','Write in DOTS','or upload a file'); Draw-Box $g 270 135 205 130 @('Ready file','or draft tracking','record'); Draw-Box $g 510 135 220 130 @('Register record','Assign number','Stamp eligible PDF') $green; Draw-Box $g 765 135 185 130 @('Forward','Select route'); Draw-Box $g 985 135 190 130 @('Receive','Office confirms'); Draw-Box $g 1210 135 245 130 @('Review + decide','Approve / changes','Reject')
Draw-Box $g 480 325 280 72 @('Tracking number + QR','on eligible records') $amber; Draw-Box $g 1195 325 275 72 @('Continue route','or mark Terminal') $green; Save-Canvas $c 'lifecycle'

$c = New-Canvas 'Sequential routing • one active office at a time' 1500 430 'Office order can be arranged before the route starts; recorded work remains in the history.'; $g=$c.Graphics
Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 245 185),(P 290 185))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 535 185),(P 590 185))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 835 185),(P 890 185))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 1135 185),(P 1190 185))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 715 245),(P 715 285),(P 790 285))) $navy
Draw-Box $g 40 125 205 120 @('Current office','sends the record'); Draw-Box $g 290 125 245 120 @('1 • Office A','Receive → review','Approve to advance') $green 'ACTIVE'; Draw-Box $g 590 125 245 120 @('2 • Office B','Waits for Office A','then receives') $amber 'NEXT'; Draw-Box $g 890 125 245 120 @('3 • Office C','Activates after','Office B approves') $amber 'QUEUED'; Draw-Box $g 1190 125 260 120 @('All required steps','approved → continue') $green; Draw-Box $g 790 285 385 72 @('Change request or rejection pauses the route') $rose; Save-Canvas $c 'sequential'

$c = New-Canvas 'Parallel routing • offices work at the same time' 1500 530 'The route remains pending until every required office approves.'; $g=$c.Graphics
Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 280 250),(P 385 250),(P 385 130),(P 430 130))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 280 250),(P 430 250))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 280 250),(P 385 250),(P 385 370),(P 430 370)))
Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 685 130),(P 810 130),(P 810 250),(P 855 250))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 685 250),(P 855 250))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 685 370),(P 810 370),(P 810 250),(P 855 250)))
Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 1130 250),(P 1170 250))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 990 310),(P 990 375))) $navy
Draw-Box $g 45 195 235 110 @('Document sent','Select offices'); Draw-Box $g 430 88 255 85 @('Office A','Receive + review') $green; Draw-Box $g 430 208 255 85 @('Office B','Receive + review') $green; Draw-Box $g 430 328 255 85 @('Office C','Receive + review') $green; Draw-Box $g 855 190 275 120 @('Wait for all','required decisions','progress per office') $amber; Draw-Box $g 1170 190 285 120 @('All required offices','approve → continue') $green; Draw-Box $g 795 375 390 75 @('Change request / rejection pauses route') $rose; Save-Canvas $c 'parallel'

$c = New-Canvas 'Child route • branch work returns to the parent office' 1500 495 'A completed child branch does not replace the parent office decision.'; $g=$c.Graphics
Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 295 237),(P 390 237),(P 390 125),(P 435 125))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 295 237),(P 435 237))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 295 237),(P 390 237),(P 390 349),(P 435 349)))
Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 690 125),(P 820 125),(P 820 237),(P 865 237))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 690 237),(P 865 237))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 690 349),(P 820 349),(P 820 237),(P 865 237))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 1105 237),(P 1150 237)))
Draw-Box $g 40 175 255 125 @('Parent Office A','Active route step','sends a child route') $green 'PARENT'; Draw-Box $g 435 82 255 86 @('Child Office B','Receive + decide') $amber; Draw-Box $g 435 194 255 86 @('Child Office C','Receive + decide') $amber; Draw-Box $g 435 306 255 86 @('Other office','Receive + decide') $amber; Draw-Box $g 865 177 240 120 @('All required','child steps','complete') $green; Draw-Box $g 1150 177 310 120 @('Return to Parent A','parent office still','records its decision') $green; Save-Canvas $c 'childroute'

$c = New-Canvas 'QR tracking and protected document actions' 1500 460 'OTP: 10-minute validity • 60-second resend cooldown • session: 20 minutes.'; $g=$c.Graphics
Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 240 187),(P 270 187))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 490 187),(P 520 187))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 740 187),(P 770 187))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 985 187),(P 1015 187))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 1240 187),(P 1270 187))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 880 250),(P 880 285),(P 950 285))) $navy
Draw-Box $g 35 125 205 125 @('Scan QR','Open signed link'); Draw-Box $g 270 125 220 125 @('View allowed','status + timeline'); Draw-Box $g 520 125 220 125 @('Enter official','official email'); Draw-Box $g 770 125 215 125 @('Verify 6-digit','email OTP'); Draw-Box $g 1015 125 225 125 @('Check office +','route permissions'); Draw-Box $g 1270 125 195 125 @('Limited session','one document') $green; Draw-Box $g 950 285 280 72 @('Invalid or expired','protected actions stay closed') $rose; Save-Canvas $c 'qr'

$c = New-Canvas 'Completion, archive, and permitted restore' 1500 390 'Operational archiving is separate from a records-retention or disposal schedule.'; $g=$c.Graphics
Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 310 178),(P 365 178))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 585 178),(P 640 178))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 860 178),(P 915 178))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 1155 178),(P 1210 178)))
Draw-Box $g 65 122 245 112 @('Holding office','finishes processing'); Draw-Box $g 365 122 220 112 @('Mark Terminal','record completion'); Draw-Box $g 640 122 220 112 @('Archived record','history retained') $green; Draw-Box $g 915 122 240 112 @('Search by year,','text, or office'); Draw-Box $g 1210 122 225 112 @('Restore when','authorized') $amber; Save-Canvas $c 'archive'

$c = New-Canvas 'Connected systems • summary data flows into DOTS' 1500 390 'External credentials and availability determine what appears; signing actions depend on the source service.'; $g=$c.Graphics
Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 420 178),(P 560 178))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 920 178),(P 1060 178)))
Draw-Box $g 80 122 340 112 @('PDMIS • DRIP • iPluma','External services'); Draw-Box $g 560 122 360 112 @('Configured API summaries','Status • records • signers') $amber; Draw-Box $g 1060 122 360 112 @('DOTS Connected Systems','Read-only summary views') $green; Save-Canvas $c 'systems'

$c = New-Canvas 'DOTS • complete system workflow' 1700 820 'Work actions are checked against account, role, office, and route permissions; external services depend on configuration.'; $g=$c.Graphics
Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 230 180),(P 270 180))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 490 180),(P 530 180))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 765 180),(P 805 180))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 1055 180),(P 1095 180))); Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 1355 180),(P 1395 180)))
Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 1225 245),(P 1225 330),(P 450 330),(P 450 380))) $blue; Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 1225 245),(P 1225 330),(P 880 330),(P 880 380))) $red; Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 1225 245),(P 1225 330),(P 1320 330),(P 1320 380))) $teal
Draw-ArrowPath $g ([System.Drawing.PointF[]]@((P 450 380),(P 450 300),(P 380 300),(P 380 245))) $blue
Draw-Box $g 30 115 200 130 @('1 • Sign in','Account + role','+ office access'); Draw-Box $g 270 115 220 130 @('2 • Prepare','Author in DOTS','or upload a file'); Draw-Box $g 530 115 235 130 @('3 • Register','Create tracking record','Assign tracking number') $green; Draw-Box $g 805 115 250 130 @('4 • Send + route','Sequential • parallel','or child office route'); Draw-Box $g 1095 115 260 130 @('5 • Receive + review','Office confirms receipt','then records a decision'); Draw-Box $g 1395 115 270 130 @('6 • Complete','Continue route, mark','Terminal, then archive') $green
Draw-Box $g 320 380 260 105 @('Changes requested','Revise file and','resubmit for review') $amber; Draw-Box $g 750 380 260 105 @('Rejected','Decision is recorded','route stops') $rose; Draw-Box $g 1190 380 260 105 @('Approved','Proceed to next','required route step') $green
Draw-Box $g 70 570 360 115 @('QR + signed tracking','Public status is limited;','OTP gates eligible actions'); Draw-Box $g 480 570 360 115 @('Dashboard + work queues','Office tasks, archives,','and audit history'); Draw-Box $g 890 570 320 115 @('Administration','Users, offices, routes,','reference data, templates'); Draw-Box $g 1260 570 370 115 @('Connected services','Email + HRIS + configured','DRIP / PDMIS / iPluma'); Save-Canvas $c 'overview'

Get-ChildItem -LiteralPath $out -Filter '*.png' | Select-Object Name,Length

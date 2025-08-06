#!/bin/bash

# MOTD安装脚本
# 将system-info.sh设置为系统登录提示信息

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEM_INFO_SCRIPT="$SCRIPT_DIR/system-info.sh"
MOTD_FILE="/etc/motd"
MOTD_D_DIR="/etc/update-motd.d"

# 检查是否为root用户
check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}❌ 此脚本需要root权限运行${NC}"
        echo -e "${YELLOW}请使用: sudo $0${NC}"
        exit 1
    fi
}

# 检查system-info.sh是否存在
check_system_info_script() {
    if [[ ! -f "$SYSTEM_INFO_SCRIPT" ]]; then
        echo -e "${RED}❌ 找不到system-info.sh脚本: $SYSTEM_INFO_SCRIPT${NC}"
        exit 1
    fi
    
    if [[ ! -x "$SYSTEM_INFO_SCRIPT" ]]; then
        echo -e "${YELLOW}⚠️  设置system-info.sh为可执行文件${NC}"
        chmod +x "$SYSTEM_INFO_SCRIPT"
    fi
}

# 备份原始MOTD
backup_original_motd() {
    if [[ -f "$MOTD_FILE" ]]; then
        local backup_file="$MOTD_FILE.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$MOTD_FILE" "$backup_file"
        echo -e "${GREEN}✅ 已备份原始MOTD到: $backup_file${NC}"
    fi
}

# 创建update-motd.d脚本
create_motd_script() {
    local motd_script="$MOTD_D_DIR/99-system-info"
    
    cat > "$motd_script" << 'EOF'
#!/bin/bash
# 系统信息显示脚本 - 由install-motd.sh自动生成

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../scripts" 2>/dev/null && pwd)"
if [[ -z "$SCRIPT_DIR" ]]; then
    SCRIPT_DIR="/opt/happy-tts/scripts"
fi

SYSTEM_INFO_SCRIPT="$SCRIPT_DIR/system-info.sh"

# 检查脚本是否存在且可执行
if [[ -f "$SYSTEM_INFO_SCRIPT" && -x "$SYSTEM_INFO_SCRIPT" ]]; then
    # 执行系统信息脚本
    "$SYSTEM_INFO_SCRIPT"
else
    # 备用方案：直接显示基本信息
    echo "=========================================="
    echo "  Happy TTS 系统信息"
    echo "=========================================="
    echo "  运行时间: $(uptime -p 2>/dev/null || echo '未知')"
    echo "  系统负载: $(uptime | awk -F'load average:' '{print $2}' 2>/dev/null || echo '未知')"
    echo "  内存使用: $(free -h | awk 'NR==2 {printf "%s / %s", $3, $2}' 2>/dev/null || echo '未知')"
    echo "  硬盘使用: $(df -h / | awk 'NR==2 {print $3 " / " $2}' 2>/dev/null || echo '未知')"
    echo "=========================================="
fi
EOF

    chmod +x "$motd_script"
    echo -e "${GREEN}✅ 已创建MOTD脚本: $motd_script${NC}"
}

# 创建静态MOTD文件
create_static_motd() {
    # 清空现有MOTD文件
    > "$MOTD_FILE"
    
    # 添加静态内容
    cat >> "$MOTD_FILE" << 'EOF'
==========================================
  Happy TTS 系统信息
==========================================
EOF

    echo -e "${GREEN}✅ 已创建静态MOTD文件${NC}"
}

# 配置PAM以使用update-motd.d
configure_pam() {
    local pam_ssh_file="/etc/pam.d/sshd"
    local pam_login_file="/etc/pam.d/login"
    
    # 检查是否已配置
    if grep -q "pam_motd.so" "$pam_ssh_file" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  SSH PAM已配置MOTD${NC}"
    else
        # 备份PAM文件
        cp "$pam_ssh_file" "${pam_ssh_file}.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null
        
        # 添加MOTD配置到SSH
        if [[ -f "$pam_ssh_file" ]]; then
            echo "session    optional     pam_motd.so motd=/run/motd.dynamic" >> "$pam_ssh_file"
            echo "session    optional     pam_motd.so noupdate" >> "$pam_ssh_file"
            echo -e "${GREEN}✅ 已配置SSH PAM MOTD${NC}"
        fi
    fi
    
    # 配置登录PAM
    if [[ -f "$pam_login_file" ]]; then
        if grep -q "pam_motd.so" "$pam_login_file" 2>/dev/null; then
            echo -e "${YELLOW}⚠️  登录PAM已配置MOTD${NC}"
        else
            cp "$pam_login_file" "${pam_login_file}.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null
            echo "session    optional     pam_motd.so motd=/run/motd.dynamic" >> "$pam_login_file"
            echo "session    optional     pam_motd.so noupdate" >> "$pam_login_file"
            echo -e "${GREEN}✅ 已配置登录PAM MOTD${NC}"
        fi
    fi
}

# 创建systemd服务（可选）
create_systemd_service() {
    local service_file="/etc/systemd/system/motd-update.service"
    local timer_file="/etc/systemd/system/motd-update.timer"
    
    # 创建服务文件
    cat > "$service_file" << 'EOF'
[Unit]
Description=Update MOTD with system information
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/run-parts /etc/update-motd.d/
StandardOutput=journal

[Install]
WantedBy=multi-user.target
EOF

    # 创建定时器文件
    cat > "$timer_file" << 'EOF'
[Unit]
Description=Update MOTD every 5 minutes
Requires=motd-update.service

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
Unit=motd-update.service

[Install]
WantedBy=timers.target
EOF

    # 启用定时器
    systemctl daemon-reload
    systemctl enable motd-update.timer
    systemctl start motd-update.timer
    
    echo -e "${GREEN}✅ 已创建并启用MOTD更新定时器${NC}"
}

# 测试MOTD显示
test_motd() {
    echo -e "${CYAN}🧪 测试MOTD显示...${NC}"
    echo -e "${CYAN}----------------------------------------${NC}"
    
    # 执行update-motd.d脚本
    if [[ -d "$MOTD_D_DIR" ]]; then
        run-parts "$MOTD_D_DIR" 2>/dev/null || echo "MOTD测试失败"
    fi
    
    echo -e "${CYAN}----------------------------------------${NC}"
}

# 显示安装信息
show_install_info() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${GREEN}🎉 MOTD安装完成！${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo -e "${YELLOW}📋 安装信息:${NC}"
    echo -e "   - 系统信息脚本: $SYSTEM_INFO_SCRIPT"
    echo -e "   - MOTD目录: $MOTD_D_DIR"
    echo -e "   - 静态MOTD文件: $MOTD_FILE"
    echo -e ""
    echo -e "${YELLOW}🔧 配置说明:${NC}"
    echo -e "   - SSH登录时会显示系统信息"
    echo -e "   - 控制台登录时会显示系统信息"
    echo -e "   - 系统信息每5分钟自动更新"
    echo -e ""
    echo -e "${YELLOW}🛠️  管理命令:${NC}"
    echo -e "   - 手动更新MOTD: sudo run-parts $MOTD_D_DIR"
    echo -e "   - 查看定时器状态: sudo systemctl status motd-update.timer"
    echo -e "   - 禁用定时器: sudo systemctl disable motd-update.timer"
    echo -e ""
    echo -e "${GREEN}✅ 下次登录时即可看到新的MOTD信息！${NC}"
}

# 主函数
main() {
    echo -e "${CYAN}🚀 开始安装MOTD系统信息显示...${NC}"
    echo ""
    
    # 检查权限
    check_root
    
    # 检查脚本
    check_system_info_script
    
    # 创建必要的目录
    mkdir -p "$MOTD_D_DIR"
    
    # 备份原始文件
    backup_original_motd
    
    # 创建MOTD脚本
    create_motd_script
    
    # 创建静态MOTD
    create_static_motd
    
    # 配置PAM
    configure_pam
    
    # 创建systemd服务
    create_systemd_service
    
    # 测试显示
    test_motd
    
    # 显示安装信息
    show_install_info
}

# 卸载函数
uninstall() {
    echo -e "${YELLOW}🗑️  开始卸载MOTD配置...${NC}"
    
    # 删除MOTD脚本
    local motd_script="$MOTD_D_DIR/99-system-info"
    if [[ -f "$motd_script" ]]; then
        rm -f "$motd_script"
        echo -e "${GREEN}✅ 已删除MOTD脚本${NC}"
    fi
    
    # 停止并禁用定时器
    systemctl stop motd-update.timer 2>/dev/null
    systemctl disable motd-update.timer 2>/dev/null
    
    # 删除systemd文件
    rm -f /etc/systemd/system/motd-update.service
    rm -f /etc/systemd/system/motd-update.timer
    systemctl daemon-reload
    
    echo -e "${GREEN}✅ MOTD配置已卸载${NC}"
    echo -e "${YELLOW}⚠️  注意：PAM配置需要手动恢复${NC}"
}

# 检查命令行参数
case "${1:-}" in
    --uninstall|-u)
        check_root
        uninstall
        ;;
    --help|-h)
        echo "用法: $0 [选项]"
        echo "选项:"
        echo "  --uninstall, -u    卸载MOTD配置"
        echo "  --help, -h         显示此帮助信息"
        echo ""
        echo "默认行为: 安装MOTD配置"
        ;;
    *)
        main
        ;;
esac 
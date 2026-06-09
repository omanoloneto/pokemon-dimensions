# Compilador mestre: converte os PBS do Essentials (XP) para JSON do MZ.
# Gera: Pokemon.json, Moves.json, Types.json, Items.json, Encounters.json
#
# Uso (a partir da raiz do repo):  ruby mz/tools/compile_all.rb
require "json"

PBS = "PBS"
OUT = "mz/data"

def write(name, data)
  path = File.join(OUT, name)
  File.write(path, JSON.pretty_generate(data))
  puts format("OK  %-18s %6.0f KB", name, File.size(path) / 1024.0)
end

#---------------------------------------------------------------------------
# POKEMON
#---------------------------------------------------------------------------
def compile_pokemon
  stat_keys = %w[hp atk def spe spa spd]
  list = []
  cur = nil
  File.foreach(File.join(PBS, "pokemon.txt"), encoding: "bom|utf-8") do |raw|
    line = raw.rstrip
    next if line.empty?
    if (m = line.match(/^\[(\d+)\]/))
      list << cur if cur
      cur = { "id" => m[1].to_i }
      next
    end
    next unless cur
    k, _, v = line.partition("="); k.strip!; v.strip!
    case k
    when "Name"         then cur["name"] = v
    when "InternalName" then cur["internalName"] = v
    when "Type1"        then cur["type1"] = v
    when "Type2"        then cur["type2"] = v
    when "Kind"         then cur["category"] = v
    when "Pokedex"      then cur["entry"] = v
    when "Height"       then cur["height"] = v.to_f
    when "Weight"       then cur["weight"] = v.to_f
    when "Color"        then cur["color"] = v
    when "Habitat"      then cur["habitat"] = v
    when "GenderRate"   then cur["genderRate"] = v
    when "GrowthRate"   then cur["growthRate"] = v
    when "Rareness"     then cur["catchRate"] = v.to_i
    when "BaseEXP"      then cur["baseExp"] = v.to_i
    when "Abilities"    then cur["abilities"] = v.split(",")
    when "HiddenAbility" then cur["hiddenAbility"] = v
    when "BaseStats"
      n = v.split(",").map(&:to_i)
      cur["stats"] = stat_keys.each_with_index.to_h { |s, i| [s, n[i] || 0] }
    when "EffortPoints"
      n = v.split(",").map(&:to_i)
      cur["evYield"] = stat_keys.each_with_index.to_h { |s, i| [s, n[i] || 0] }
    when "Moves"
      parts = v.split(",")
      mv = []
      parts.each_slice(2) { |lvl, mid| mv << { "level" => lvl.to_i, "move" => mid } if mid }
      cur["levelMoves"] = mv
    when "Evolutions"
      p = v.split(",")
      evs = []
      p.each_slice(3) { |sp, meth, param| evs << { "into" => sp, "method" => meth, "param" => param } if sp }
      cur["evolutions"] = evs
    end
  end
  list << cur if cur
  write("Pokemon.json", [nil] + list)
end

#---------------------------------------------------------------------------
# MOVES  (id,INTERNAL,Name,func,power,TYPE,Category,acc,pp,effChance,target,prio,flags,"desc")
#---------------------------------------------------------------------------
def compile_moves
  by_internal = {}
  File.foreach(File.join(PBS, "moves.txt"), encoding: "bom|utf-8") do |raw|
    line = raw.strip
    next if line.empty? || line.start_with?("#")
    # split respeitando a descrição entre aspas no fim
    f = line.split(",", 14)
    next if f.size < 13
    desc = (f[13] || "").gsub(/\A"|"\z/, "")
    by_internal[f[1]] = {
      "id" => f[0].to_i,
      "internalName" => f[1],
      "name" => f[2],
      "functionCode" => f[3],
      "power" => f[4].to_i,
      "type" => f[5],
      "category" => f[6],          # Physical | Special | Status
      "accuracy" => f[7].to_i,     # 0 = nunca erra
      "pp" => f[8].to_i,
      "effectChance" => f[9].to_i,
      "target" => f[10],
      "priority" => f[11].to_i,
      "flags" => f[12],
      "description" => desc
    }
  end
  write("Moves.json", by_internal)
end

#---------------------------------------------------------------------------
# TYPES  -> tabela de eficácia atacante->defensor
#---------------------------------------------------------------------------
def compile_types
  types = {}
  cur = nil
  File.foreach(File.join(PBS, "types.txt"), encoding: "bom|utf-8") do |raw|
    line = raw.strip
    next if line.empty?
    if line.match(/^\[(\d+)\]/)
      cur = {}
      next
    end
    next unless cur
    k, _, v = line.partition("="); k.strip!; v.strip!
    case k
    when "InternalName" then cur["internalName"] = v; types[v] = cur
    when "Name"         then cur["name"] = v
    when "Weaknesses"   then cur["weakTo"] = v.split(",")    # recebe 2x destes
    when "Resistances"  then cur["resistTo"] = v.split(",")  # recebe 0.5x destes
    when "Immunities"   then cur["immuneTo"] = v.split(",")  # recebe 0x destes
    when "IsPseudoType" then cur["pseudo"] = true
    when "IsSpecialType" then cur["special"] = true
  end
  end
  # monta chart[atacante][defensor] = multiplicador
  names = types.keys
  chart = {}
  names.each do |atk|
    chart[atk] = {}
    names.each do |dfn|
      d = types[dfn]
      mult = 1.0
      mult = 2.0 if (d["weakTo"] || []).include?(atk)
      mult = 0.5 if (d["resistTo"] || []).include?(atk)
      mult = 0.0 if (d["immuneTo"] || []).include?(atk)
      chart[atk][dfn] = mult
    end
  end
  write("Types.json", { "types" => types, "chart" => chart })
end

#---------------------------------------------------------------------------
# ITEMS  (id,INTERNAL,Name,Plural,pocket,price,"desc",field,battle,type,move)
#---------------------------------------------------------------------------
def compile_items
  by_internal = {}
  File.foreach(File.join(PBS, "items.txt"), encoding: "bom|utf-8") do |raw|
    line = raw.strip
    next if line.empty? || line.start_with?("#")
    f = line.split(",", 11)
    next if f.size < 7
    desc = (f[6] || "").gsub(/\A"|"\z/, "")
    by_internal[f[1]] = {
      "id" => f[0].to_i,
      "internalName" => f[1],
      "name" => f[2],
      "plural" => f[3],
      "pocket" => f[4].to_i,
      "price" => f[5].to_i,
      "description" => desc,
      "fieldUse" => (f[7] || "0").to_i,
      "battleUse" => (f[8] || "0").to_i,
      "machine" => (f[10] || "").strip
    }
  end
  write("Items.json", by_internal)
end

#---------------------------------------------------------------------------
# ENCOUNTERS  (blocos por mapa, métodos com slots SPECIES,min[,max])
#---------------------------------------------------------------------------
def compile_encounters
  methods = %w[Land LandDay LandNight LandMorning Cave Water OldRod GoodRod
               SuperRod RockSmash HeadbuttLow HeadbuttHigh BugContest]
  maps = {}
  cur_map = nil
  cur_method = nil
  File.foreach(File.join(PBS, "encounters.txt"), encoding: "bom|utf-8") do |raw|
    line = raw.strip
    next if line.empty? || line.start_with?("#")
    if (m = line.match(/^(\d+)\s*(#.*)?$/))
      cur_map = m[1].to_i
      maps[cur_map] = { "densities" => [], "methods" => {} }
      cur_method = nil
      next
    end
    next unless cur_map
    if methods.include?(line)
      cur_method = line
      maps[cur_map]["methods"][cur_method] = []
      next
    end
    if cur_method.nil? && line.match(/^\d+(,\d+)*$/)
      maps[cur_map]["densities"] = line.split(",").map(&:to_i)
      next
    end
    if cur_method && (m = line.match(/^([A-Z0-9_]+),(\d+)(?:,(\d+))?$/))
      maps[cur_map]["methods"][cur_method] << {
        "species" => m[1], "min" => m[2].to_i, "max" => (m[3] || m[2]).to_i
      }
    end
  end
  write("Encounters.json", maps)
end

#---------------------------------------------------------------------------
# TRAINERS  (trainertypes.txt + trainers.txt)
#---------------------------------------------------------------------------
def compile_trainers
  # tipos de treinador: id,InternalName,Nome,baseMoney,bgm,...,gender,...
  types = {}
  File.foreach(File.join(PBS, "trainertypes.txt"), encoding: "bom|utf-8") do |raw|
    line = raw.strip
    next if line.empty? || line.start_with?("#")
    f = line.split(",")
    next if f.size < 3
    types[f[1]] = {
      "id" => f[0].to_i, "internalName" => f[1], "name" => f[2],
      "baseMoney" => (f[3] || "30").to_i, "battleBGM" => (f[4] || "").strip,
      "gender" => (f[7] || "").strip
    }
  end

  # treinadores: linhas úteis (sem comentários/branco), parse sequencial
  lines = []
  File.foreach(File.join(PBS, "trainers.txt"), encoding: "bom|utf-8") do |raw|
    s = raw.rstrip
    next if s.strip.empty? || s.strip.start_with?("#")
    lines << s
  end

  list = []
  i = 0
  while i < lines.size
    type = lines[i].strip; i += 1
    break if i >= lines.size
    nf = lines[i].split(","); i += 1
    name = nf[0].strip
    party_id = nf[1] ? nf[1].to_i : 0
    break if i >= lines.size
    cf = lines[i].split(","); i += 1
    count = cf[0].to_i
    items = (cf[1..] || []).map(&:strip).reject(&:empty?)
    party = []
    count.times do
      break if i >= lines.size
      pf = lines[i].split(","); i += 1
      moves = [pf[3], pf[4], pf[5], pf[6]].compact.map(&:strip).reject(&:empty?)
      gender = pf.map { |x| x.to_s.strip }.find { |x| x == "M" || x == "F" }
      shiny = pf.any? { |x| %w[shiny true].include?(x.to_s.strip.downcase) }
      party << {
        "species" => pf[0].to_s.strip, "level" => (pf[1] || "5").to_i,
        "item" => (pf[2] && !pf[2].strip.empty? ? pf[2].strip : nil),
        "moves" => moves, "gender" => gender, "shiny" => shiny
      }
    end
    next if party.empty?
    list << { "type" => type, "name" => name, "partyId" => party_id, "items" => items, "party" => party }
  end
  write("Trainers.json", { "types" => types, "list" => list })
end

Dir.mkdir(OUT) unless Dir.exist?(OUT)
compile_pokemon
compile_moves
compile_types
compile_items
compile_encounters
compile_trainers
puts "Pronto."

